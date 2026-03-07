import os
import hashlib
from functools import lru_cache
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from groq_key_rotator import get_groq_rotator

CHROMA_DIR  = "./chroma_db"
EMBED_MODEL = "all-MiniLM-L6-v2"

# ── State ─────────────────────────────────────────────────
_answer_cache = {}
CACHE_MAX     = 100
stats_log     = []
all_questions = []

# ── Office definitions (mirror of ingest.py) ──────────────
OFFICES = {
    "study_office":  { "name": "Study Office",                  "emoji": "📚", "keywords": ["course","subject","curriculum","grade","exam","credit","registration","enrolment","transcript","timetable","schedule","beiratkozás","kurzus","tanulmány"] },
    "iro":           { "name": "International Relations Office", "emoji": "🌍", "keywords": ["international","erasmus","exchange","visa","residence","foreign","scholarship abroad","iro","international student","külföldi","ösztöndíj","csere"] },
    "finance":       { "name": "Finance & Fees Office",          "emoji": "💰", "keywords": ["fee","tuition","payment","invoice","scholarship","financial","refund","bank","díj","fizetés","pénzügy"] },
    "it_helpdesk":   { "name": "IT Helpdesk",                    "emoji": "💻", "keywords": ["it","wifi","password","computer","system","login","email","vpn","software","hardware","network","számítógép","jelszó"] },
    "library":       { "name": "Library",                        "emoji": "📖", "keywords": ["library","book","journal","borrow","return","database","opening hours","könyvtár","könyv"] },
    "student_union": { "name": "Student Union",                  "emoji": "🎓", "keywords": ["student union","club","event","sport","dormitory","housing","accommodation","kollégium"] },
    "cs_dept":       { "name": "Computer Science Dept.",         "emoji": "🖥️", "keywords": ["computer science","programming","software","algorithm","cs","informatika","programozás"] },
    "engineering":   { "name": "Engineering Dept.",              "emoji": "⚙️", "keywords": ["engineering","mechanical","electrical","manufacturing","műszaki","gépész"] },
    "economics":     { "name": "Economics & Business Dept.",     "emoji": "📈", "keywords": ["economics","business","management","marketing","accounting","gazdaság","üzlet"] },
    "general":       { "name": "General / University-wide",      "emoji": "🏛️", "keywords": [] },
}


def detect_office(question: str) -> str:
    """Auto-detect the most relevant office from a question using keywords."""
    lower = question.lower()
    scores = {}
    for office_id, info in OFFICES.items():
        if office_id == "general":
            continue
        score = sum(1 for kw in info["keywords"] if kw in lower)
        if score > 0:
            scores[office_id] = score
    if not scores:
        return "general"
    return max(scores, key=scores.get)


def _cache_key(question: str, major: str, year: str, office: str, nationality: str) -> str:
    return hashlib.md5(f"{question.lower().strip()}|{major}|{year}|{office}|{nationality}".encode()).hexdigest()


@lru_cache(maxsize=1)
def get_embeddings():
    print("[UniAdvisor] Loading embedding model...")
    return HuggingFaceEmbeddings(
        model_name=EMBED_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


@lru_cache(maxsize=1)
def get_vectorstore():
    print("[UniAdvisor] Loading vector store...")
    return Chroma(
        persist_directory=CHROMA_DIR,
        embedding_function=get_embeddings(),
        collection_name="university_docs",
    )


def get_answer(
    question:            str,
    student_name:        str  = "Student",
    student_year:        str  = "Year 1",
    student_major:       str  = "General",
    student_nationality: str  = "Hungarian",
    office:              str  = "auto",
    history:             list = None,
) -> tuple:
    """
    Returns: (answer, sources, detected_office)

    office: "auto" = keyword-detect, otherwise use the provided office ID.
    student_nationality: used to tailor scholarship/visa advice for international students.
    """
    if history is None:
        history = []

    rotator     = get_groq_rotator()
    vectorstore = get_vectorstore()

    all_questions.append(question)

    # ── Office detection ──────────────────────────────────
    # If student is non-Hungarian and asking about scholarships/visa,
    # bias toward IRO even if "auto"
    if (not office or office == "auto"):
        office = detect_office(question)
        if student_nationality.lower() not in ("hungarian", "magyar"):
            international_triggers = ["scholarship","visa","residence","permit","erasmus","exchange","tuition","fee","support"]
            if any(t in question.lower() for t in international_triggers):
                office = "iro"

    cache_key = _cache_key(question, student_major, student_year, office, student_nationality)
    if cache_key in _answer_cache and not history:
        print("[UniAdvisor] Cache hit!")
        cached = _answer_cache[cache_key]
        return cached["answer"], cached["sources"], cached["office"]

    doc_count   = vectorstore._collection.count()
    office_info = OFFICES.get(office, OFFICES["general"])

    # ── Build nationality context note ────────────────────
    is_international = student_nationality.lower() not in ("hungarian", "magyar")
    nationality_note = (
        f"NOTE: {student_name} is an INTERNATIONAL student (nationality: {student_nationality}). "
        f"Provide relevant information about international student requirements, visa rules, "
        f"and Erasmus/scholarship options where applicable. "
    ) if is_international else ""

    # ── No documents fallback ─────────────────────────────
    if doc_count == 0:
        prompt = (
            f"You are UniAdvisor AI for Dunaujvaros Egyetem. "
            f"You are helping {student_name}, a {student_year} student studying {student_major} "
            f"(nationality: {student_nationality}). "
            f"{nationality_note}"
            f"No university documents have been uploaded yet — answer based on general knowledge. "
            f"Respond in the same language as the question.\n\n"
            f"Question: {question}\nAnswer:"
        )
        response = rotator.chat(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400, temperature=0.3, model="llama-3.1-8b-instant",
        )
        return response.choices[0].message.content, [], office

    # ── Vector search: office-filtered, fall back to global ─
    where_filter = {"office": {"$eq": office}} if office != "general" else None
    try:
        if where_filter:
            docs = vectorstore.similarity_search(question, k=4, filter=where_filter)
            if not docs:
                print(f"[UniAdvisor] No docs for office '{office}', falling back to global search")
                docs = vectorstore.similarity_search(question, k=4)
        else:
            docs = vectorstore.similarity_search(question, k=4)
    except Exception:
        docs = vectorstore.similarity_search(question, k=4)

    context = "\n\n".join([d.page_content for d in docs])

    # ── Build citations ───────────────────────────────────
    seen, sources = set(), []
    for d in docs:
        src  = d.metadata.get("source", "University Document")
        page = d.metadata.get("page", None)
        off  = d.metadata.get("office", office)
        key  = f"{src}|{page}"
        if key not in seen:
            seen.add(key)
            entry = {
                "file":        src,
                "office":      off,
                "office_name": OFFICES.get(off, {}).get("name", off),
                "office_emoji":OFFICES.get(off, {}).get("emoji", "🏛️"),
            }
            if page is not None:
                entry["page"] = page + 1
            sources.append(entry)

    # ── Detect question language explicitly ──────────────
    hu_chars = set("áéíóöőüűÁÉÍÓÖŐÜŰ")
    hu_words  = {"az","egy","és","hogy","nem","van","mi","de","ezt","azt","kérem",
                 "köszönöm","mikor","hogyan","hol","melyik","mik","milyen","mennyi",
                 "mikor","határidő","kurzus","beiratkozás","tandíj","ösztöndíj"}
    q_lower   = question.lower()
    has_hu_chars = any(c in hu_chars for c in question)
    has_hu_words = any(w in q_lower.split() for w in hu_words)
    reply_lang   = "Hungarian" if (has_hu_chars or has_hu_words) else "English"
    reply_lang_instruction = (
        f"IMPORTANT: The student wrote in {reply_lang}. "
        f"You MUST reply in {reply_lang} only. Do not switch languages."
    )

    # ── Build conversation history string ─────────────────
    history_str = ""
    for msg in (history or [])[-2:]:
        role = "Student" if msg.get("role") == "user" else "Advisor"
        history_str += f"{role}: {msg.get('content', '')}\n"

    # ── System prompt ─────────────────────────────────────
    system_msg = (
        f"You are UniAdvisor AI for Dunaujvaros Egyetem (University of Dunaújváros), Hungary.\n"
        f"You are the virtual assistant for the {office_info['emoji']} {office_info['name']}.\n"
        f"You are helping {student_name}, a {student_year} student studying {student_major} "
        f"(nationality: {student_nationality}).\n"
        f"{nationality_note}"
        f"\n{reply_lang_instruction}\n"
        f"\nRules:\n"
        f"- Answer ONLY based on the context provided below.\n"
        f"- If the context does not contain the answer, clearly say so and suggest the student "
        f"contact the {office_info['name']} directly.\n"
        f"- Be concise, friendly, and helpful.\n"
        f"- Use bullet points for lists.\n"
        f"\nContext from {office_info['name']} documents:\n{context}"
    )

    messages = [{"role": "system", "content": system_msg}]
    if history_str:
        messages.append({
            "role": "user",
            "content": f"Recent conversation:\n{history_str}\nNew question: {question}"
        })
    else:
        messages.append({"role": "user", "content": question})

    response = rotator.chat(
        messages=messages,
        max_tokens=700,
        temperature=0.1,
        model="llama-3.1-8b-instant",
    )
    answer = response.choices[0].message.content

    # ── Cache result ──────────────────────────────────────
    if len(_answer_cache) >= CACHE_MAX:
        del _answer_cache[next(iter(_answer_cache))]
    _answer_cache[cache_key] = {"answer": answer, "sources": sources, "office": office}

    stats_log.append({
        "timestamp":     datetime.now().isoformat(),
        "question":      question,
        "student_major": student_major,
        "student_year":  student_year,
        "student_nationality": student_nationality,
        "office":        office,
    })

    return answer, sources, office


def get_stats() -> dict:
    total = len(stats_log)
    majors, years, offices_count, nationalities = {}, {}, {}, {}

    for e in stats_log:
        m = e.get("student_major",       "Unknown")
        y = e.get("student_year",        "Unknown")
        o = e.get("office",              "general")
        n = e.get("student_nationality", "Unknown")
        majors[m]        = majors.get(m, 0)        + 1
        years[y]         = years.get(y,  0)        + 1
        offices_count[o] = offices_count.get(o, 0) + 1
        nationalities[n] = nationalities.get(n, 0) + 1

    try:
        indexed = get_vectorstore()._collection.count()
    except Exception:
        indexed = 0

    return {
        "total_questions":       total,
        "questions_by_major":    majors,
        "questions_by_year":     years,
        "questions_by_office":   offices_count,
        "questions_by_nationality": nationalities,
        "indexed_chunks":        indexed,
        "cached_answers":        len(_answer_cache),
        "recent_questions":      [e["question"] for e in stats_log[-5:]],
        "all_questions":         all_questions,
    }