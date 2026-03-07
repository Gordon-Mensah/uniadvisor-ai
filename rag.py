import os
import hashlib
from functools import lru_cache
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from groq_key_rotator import get_groq_rotator

CHROMA_DIR  = os.getenv("CHROMA_DIR", "./chroma_db")
EMBED_MODEL = "all-MiniLM-L6-v2"

os.environ.setdefault(
    "SENTENCE_TRANSFORMERS_HOME",
    os.getenv("SENTENCE_TRANSFORMERS_HOME", "./.model_cache")
)

# ── State ─────────────────────────────────────────────────
_answer_cache = {}
CACHE_MAX     = 200
stats_log     = []
all_questions = []

# ── Office definitions ────────────────────────────────────
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

# ── Hungarian detection ───────────────────────────────────
_HU_CHARS = set("áéíóöőüűÁÉÍÓÖŐÜŰ")
_HU_WORDS  = {
    "az","egy","és","hogy","nem","van","mi","de","ezt","azt",
    "kérem","köszönöm","mikor","hogyan","hol","melyik","mik",
    "milyen","mennyi","határidő","kurzus","beiratkozás","tandíj",
    "ösztöndíj","vizsgá","vizsga","tantárgy","félév","felvétel",
    "könyvtár","díj","fizetés","jelszó","számítógép","kollégium",
    "igen","nem","szia","hello","üdvözlet","segítség","szeretném",
    "lehet","kell","tudok","tudna","lenne","lesz","volt","nincs",
}

def detect_language(text: str) -> str:
    """
    Returns 'hu' if the text is Hungarian, 'en' otherwise.
    Checks for Hungarian-specific characters and common Hungarian words.
    """
    # Presence of Hungarian-specific accented chars is a strong signal
    if any(c in _HU_CHARS for c in text):
        return "hu"
    # Check for Hungarian words (word-boundary match)
    words = set(text.lower().split())
    if words & _HU_WORDS:
        return "hu"
    return "en"


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
    return max(scores, key=scores.get) if scores else "general"


def _cache_key(question: str, major: str, year: str, office: str, nationality: str) -> str:
    return hashlib.md5(f"{question.lower().strip()}|{major}|{year}|{office}|{nationality}".encode()).hexdigest()


@lru_cache(maxsize=1)
def get_embeddings():
    print("[UniAdvisor] Loading embedding model...")
    return HuggingFaceEmbeddings(
        model_name=EMBED_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True, "batch_size": 32},
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
    Target latency: <3 seconds using llama-3.1-8b-instant
    """
    if history is None:
        history = []

    rotator     = get_groq_rotator()
    vectorstore = get_vectorstore()

    all_questions.append(question)

    # ── Language detection — done ONCE, used everywhere ──
    # Check current question first; if unclear, check last user message
    lang = detect_language(question)
    if lang == "en" and history:
        last_user = next(
            (m["content"] for m in reversed(history) if m.get("role") == "user"),
            None
        )
        if last_user:
            lang = detect_language(last_user)

    # ── Office detection ──────────────────────────────────
    if not office or office == "auto":
        office = detect_office(question)
        # International students asking about money/visa → IRO
        if student_nationality.lower() not in ("hungarian", "magyar"):
            if any(t in question.lower() for t in ["scholarship","visa","residence","permit","erasmus","exchange","tuition","fee"]):
                office = "iro"

    # ── Cache check (skip cache when history present) ─────
    cache_key = _cache_key(question, student_major, student_year, office, student_nationality)
    if cache_key in _answer_cache and not history:
        print("[UniAdvisor] Cache hit!")
        cached = _answer_cache[cache_key]
        return cached["answer"], cached["sources"], cached["office"]

    doc_count   = vectorstore._collection.count()
    office_info = OFFICES.get(office, OFFICES["general"])

    # ── Language instruction (strict, concise) ────────────
    if lang == "hu":
        lang_instruction = "Válaszolj CSAK magyarul. Ne használj angolt."
    else:
        lang_instruction = "Reply in ENGLISH only. Do not use Hungarian."

    # ── No documents fallback ─────────────────────────────
    if doc_count == 0:
        is_intl = student_nationality.lower() not in ("hungarian", "magyar")
        prompt  = (
            f"You are UniAdvisor AI at Dunaujvaros Egyetem. "
            f"Student: {student_name}, {student_major}. "
            f"{'International student. ' if is_intl else ''}"
            f"{lang_instruction} "
            f"No documents uploaded yet — use general knowledge. Be concise.\n"
            f"Q: {question}\nA:"
        )
        response = rotator.chat(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.2,
            model="llama-3.1-8b-instant",   # fastest model
        )
        return response.choices[0].message.content, [], office

    # ── Vector search: k=2 for speed ─────────────────────
    where_filter = {"office": {"$eq": office}} if office != "general" else None
    try:
        if where_filter:
            docs = vectorstore.similarity_search(question, k=2, filter=where_filter)
            if not docs:
                docs = vectorstore.similarity_search(question, k=2)
        else:
            docs = vectorstore.similarity_search(question, k=2)
    except Exception:
        docs = vectorstore.similarity_search(question, k=2)

    # ── Truncate context to keep prompt short ─────────────
    # ~600 chars per chunk × 2 chunks = ~1200 chars context
    context_parts = []
    for d in docs:
        text = d.page_content.strip()
        if len(text) > 600:
            text = text[:600] + "…"
        context_parts.append(text)
    context = "\n\n".join(context_parts)

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
                "file":         src,
                "office":       off,
                "office_name":  OFFICES.get(off, {}).get("name", off),
                "office_emoji": OFFICES.get(off, {}).get("emoji", "🏛️"),
            }
            if page is not None:
                entry["page"] = page + 1
            sources.append(entry)

    # ── System prompt — kept SHORT for speed ─────────────
    is_intl = student_nationality.lower() not in ("hungarian", "magyar")
    system_msg = (
        f"UniAdvisor AI — {office_info['emoji']} {office_info['name']}, Dunaujvaros Egyetem.\n"
        f"Student: {student_name}, {student_year}, {student_major}"
        f"{', international (' + student_nationality + ')' if is_intl else ''}.\n"
        f"{lang_instruction}\n"
        f"Answer ONLY from the context below. Be concise — use bullet points for lists. "
        f"If not in context, say so and direct to {office_info['name']}.\n\n"
        f"Context:\n{context}"
    )

    # ── Build messages — last 4 history messages only ─────
    messages = [{"role": "system", "content": system_msg}]
    for msg in (history or [])[-4:]:
        role = msg.get("role", "user")
        if role not in ("user", "assistant"):
            role = "user"
        messages.append({"role": role, "content": msg.get("content", "")})
    messages.append({"role": "user", "content": question})

    # ── LLM call — llama-3.1-8b-instant is the fastest ───
    response = rotator.chat(
        messages=messages,
        max_tokens=220,          # was 380 — shorter = faster
        temperature=0.1,
        model="llama-3.1-8b-instant",
    )
    answer = response.choices[0].message.content

    # ── Cache ─────────────────────────────────────────────
    if len(_answer_cache) >= CACHE_MAX:
        del _answer_cache[next(iter(_answer_cache))]
    _answer_cache[cache_key] = {"answer": answer, "sources": sources, "office": office}

    stats_log.append({
        "timestamp":           datetime.now().isoformat(),
        "question":            question,
        "student_major":       student_major,
        "student_year":        student_year,
        "student_nationality": student_nationality,
        "office":              office,
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
        "total_questions":          total,
        "questions_by_major":       majors,
        "questions_by_year":        years,
        "questions_by_office":      offices_count,
        "questions_by_nationality": nationalities,
        "indexed_chunks":           indexed,
        "cached_answers":           len(_answer_cache),
        "recent_questions":         [e["question"] for e in stats_log[-5:]],
        "all_questions":            all_questions,
    }