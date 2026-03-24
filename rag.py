"""
rag.py  —  UniAdvisor AI  (ultra-fast, no embeddings)
──────────────────────────────────────────────────────
FIX: Language is now 100% controlled by the frontend toggle.
     No auto-detection from message content whatsoever.
     reply_lang="en" → always English
     reply_lang="hu" → always Hungarian
     No value → defaults to English
"""

import os, re, math, json, hashlib, threading
from datetime import datetime
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()
from groq_key_rotator import get_groq_rotator

DOCS_DIR  = os.getenv("DOCS_DIR", "./uploaded_docs")
CACHE_MAX = 200

_answer_cache = {}
_doc_chunks   = []   # {"text","source","office","page","tokens"}
_doc_lock     = threading.Lock()
stats_log     = []
all_questions = []

OFFICES = {
    "study_office":  {"name":"Study Office",                  "emoji":"📚","keywords":["course","subject","curriculum","grade","exam","credit","registration","enrolment","transcript","timetable","schedule","beiratkozás","kurzus","tanulmány","vizsga","féléve"]},
    "iro":           {"name":"International Relations Office", "emoji":"🌍","keywords":["international","erasmus","exchange","visa","residence","foreign","scholarship abroad","iro","international student","külföldi","ösztöndíj","csere","tartózkodási"]},
    "finance":       {"name":"Finance & Fees Office",          "emoji":"💰","keywords":["fee","tuition","payment","invoice","scholarship","financial","refund","bank","díj","fizetés","pénzügy","ösztöndíj","számla"]},
    "it_helpdesk":   {"name":"IT Helpdesk",                    "emoji":"💻","keywords":["it","wifi","password","computer","system","login","email","vpn","software","hardware","network","számítógép","jelszó","internet"]},
    "library":       {"name":"Library",                        "emoji":"📖","keywords":["library","book","journal","borrow","return","database","opening hours","könyvtár","könyv","folyóirat"]},
    "student_union": {"name":"Student Union",                  "emoji":"🎓","keywords":["student union","club","event","sport","dormitory","housing","accommodation","kollégium","diákunió","esemény"]},
    "cs_dept":       {"name":"Computer Science Dept.",         "emoji":"🖥️","keywords":["computer science","programming","software","algorithm","cs","informatika","programozás"]},
    "engineering":   {"name":"Engineering Dept.",              "emoji":"⚙️","keywords":["engineering","mechanical","electrical","manufacturing","műszaki","gépész"]},
    "economics":     {"name":"Economics & Business Dept.",     "emoji":"📈","keywords":["economics","business","management","marketing","accounting","gazdaság","üzlet"]},
    "general":       {"name":"General / University-wide",      "emoji":"🏛️","keywords":[]},
}


# ── Document store ────────────────────────────────────────

def _tokenize(text):
    return re.findall(r"[a-záéíóöőüűA-ZÁÉÍÓÖŐÜŰ0-9]+", text.lower())

def _chunk_text(text, chunk_size=400, overlap=80):
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        c = " ".join(words[i:i+chunk_size])
        if c.strip():
            chunks.append(c)
        i += chunk_size - overlap
    return chunks

def add_document(text, source, office="general", page=None):
    chunks = _chunk_text(text)
    with _doc_lock:
        for chunk in chunks:
            _doc_chunks.append({"text":chunk,"source":source,"office":office,"page":page,"tokens":_tokenize(chunk)})
    print(f"[UniAdvisor] +{len(chunks)} chunks '{source}' office={office}")

def clear_documents(office=None):
    global _doc_chunks
    with _doc_lock:
        _doc_chunks = [d for d in _doc_chunks if d["office"]!=office] if office else []

def doc_count():
    return len(_doc_chunks)

def save_docs_to_disk():
    os.makedirs(DOCS_DIR, exist_ok=True)
    with _doc_lock:
        data = [{"text":d["text"],"source":d["source"],"office":d["office"],"page":d["page"]} for d in _doc_chunks]
    with open(os.path.join(DOCS_DIR,"_chunks.json"),"w",encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"[UniAdvisor] Saved {len(data)} chunks")

def load_docs_from_disk():
    path = os.path.join(DOCS_DIR,"_chunks.json")
    if not os.path.exists(path):
        return
    with open(path,"r",encoding="utf-8") as f:
        data = json.load(f)
    global _doc_chunks
    with _doc_lock:
        _doc_chunks = [{"text":d["text"],"source":d["source"],"office":d.get("office","general"),"page":d.get("page"),"tokens":_tokenize(d["text"])} for d in data]
    print(f"[UniAdvisor] Loaded {len(_doc_chunks)} chunks from disk")


# ── BM25 search ───────────────────────────────────────────

def _bm25_search(query, office=None, k=3):
    with _doc_lock:
        pool = [d for d in _doc_chunks if office is None or d["office"]==office or office=="general"]
        if not pool:
            pool = list(_doc_chunks)
    if not pool:
        return []
    qtoks = _tokenize(query)
    if not qtoks:
        return pool[:k]
    k1, b = 1.5, 0.75
    N = len(pool)
    avgdl = sum(len(d["tokens"]) for d in pool) / N
    idf = {}
    for t in set(qtoks):
        df = sum(1 for d in pool if t in d["tokens"])
        idf[t] = math.log((N-df+0.5)/(df+0.5)+1)
    scores = []
    for i, doc in enumerate(pool):
        dl = len(doc["tokens"])
        tf_map = defaultdict(int)
        for t in doc["tokens"]: tf_map[t] += 1
        score = sum(idf.get(t,0)*tf_map[t]*(k1+1)/(tf_map[t]+k1*(1-b+b*dl/avgdl)) for t in qtoks if tf_map[t]>0)
        if score > 0:
            scores.append((score, i))
    scores.sort(reverse=True)
    return [pool[i] for _,i in scores[:k]]


# ── Office detection ──────────────────────────────────────

def detect_office(question):
    lower = question.lower()
    scores = {oid: sum(1 for kw in info["keywords"] if kw in lower)
              for oid, info in OFFICES.items() if oid!="general"}
    scores = {k:v for k,v in scores.items() if v>0}
    return max(scores, key=scores.get) if scores else "general"

def _cache_key(question, major, year, office, nationality, lang):
    return hashlib.md5(f"{question.lower().strip()}|{major}|{year}|{office}|{nationality}|{lang}".encode()).hexdigest()


# ── Main answer function ──────────────────────────────────

def get_answer(question, student_name="Student", student_year="Year 1",
               student_major="General", student_nationality="Hungarian",
               office="auto", history=None, reply_lang=None):
    if history is None:
        history = []
    rotator = get_groq_rotator()
    all_questions.append(question)

    # ── Office detection ──────────────────────────────────
    if not office or office == "auto":
        office = detect_office(question)
        if student_nationality.lower() not in ("hungarian","magyar"):
            if any(t in question.lower() for t in ["scholarship","visa","residence","permit","erasmus","exchange","tuition","fee"]):
                office = "iro"

    # ── LANGUAGE: explicit from frontend ONLY — zero auto-detection ──
    # reply_lang is set by the user's toggle in the UI.
    # "en" or anything else → English
    # "hu" → Hungarian
    # This NEVER changes based on what the user typed.
    if reply_lang == "hu":
        lang = "Hungarian"
    else:
        lang = "English"

    # Cache (now includes lang so EN/HU get separate cached answers)
    ck = _cache_key(question, student_major, student_year, office, student_nationality, lang)
    if ck in _answer_cache and not history:
        c = _answer_cache[ck]
        return c["answer"], c["sources"], c["office"]

    office_info  = OFFICES.get(office, OFFICES["general"])
    is_intl      = student_nationality.lower() not in ("hungarian","magyar")
    nat_note     = f"Student is international ({student_nationality}): mention visa/Erasmus info if relevant. " if is_intl else ""

    # No docs fallback
    if doc_count() == 0:
        r = rotator.chat(
            messages=[{"role":"user","content":f"UniAdvisor AI, Dunaujvaros Egyetem. {nat_note}You MUST reply in {lang} only. No docs yet — use general knowledge.\nQ: {question}\nA:"}],
            max_tokens=320, temperature=0.3, model="llama-3.1-8b-instant",
        )
        return r.choices[0].message.content, [], office

    # BM25 search
    docs = _bm25_search(question, office=office, k=3)
    if not docs and office != "general":
        docs = _bm25_search(question, office=None, k=3)

    context = "\n\n".join(d["text"] for d in docs)

    # Sources
    seen, sources = set(), []
    for d in docs:
        key = f"{d['source']}|{d['page']}"
        if key not in seen:
            seen.add(key)
            entry = {"file":d["source"],"office":d["office"],
                     "office_name":OFFICES.get(d["office"],{}).get("name",d["office"]),
                     "office_emoji":OFFICES.get(d["office"],{}).get("emoji","🏛️")}
            if d["page"] is not None:
                entry["page"] = d["page"]+1
            sources.append(entry)

    # ── System prompt — language lock is ABSOLUTE ─────────
    sys = (
        f"UniAdvisor AI — {office_info['emoji']} {office_info['name']}, Dunaujvaros Egyetem.\n"
        f"Student: {student_name}, {student_year}, {student_major} ({student_nationality}).\n"
        f"{nat_note}"
        f"\n"
        f"LANGUAGE RULE — THIS IS ABSOLUTE AND CANNOT BE OVERRIDDEN:\n"
        f"You MUST reply in {lang} ONLY.\n"
        f"Do NOT switch to any other language regardless of what language the student writes in.\n"
        f"Do NOT mix languages. Do NOT add translations.\n"
        f"Every single word of your response must be in {lang}.\n"
        f"\n"
        f"Answer from the context below only. If the answer is not in the context, say so politely and refer to {office_info['name']}.\n"
        f"Be concise. Use bullet points for lists.\n"
        f"\nContext:\n{context}"
    )

    msgs = [{"role":"system","content":sys}]
    for m in (history or [])[-4:]:
        role = m.get("role","user")
        if role not in ("user","assistant"): role = "user"
        msgs.append({"role":role,"content":m.get("content","")})
    msgs.append({"role":"user","content":question})

    r = rotator.chat(messages=msgs, max_tokens=320, temperature=0.1, model="llama-3.1-8b-instant")
    answer = r.choices[0].message.content

    # Cache
    if len(_answer_cache) >= CACHE_MAX:
        del _answer_cache[next(iter(_answer_cache))]
    _answer_cache[ck] = {"answer":answer,"sources":sources,"office":office}

    stats_log.append({"timestamp":datetime.now().isoformat(),"question":question,
                      "student_major":student_major,"student_year":student_year,
                      "student_nationality":student_nationality,"office":office})
    return answer, sources, office


# ── Stats ─────────────────────────────────────────────────

def get_stats():
    total = len(stats_log)
    majors, years, offices_count, nationalities = {},{},{},{}
    for e in stats_log:
        for d,k in [(majors,"student_major"),(years,"student_year"),(offices_count,"office"),(nationalities,"student_nationality")]:
            v = e.get(k,"Unknown"); d[v] = d.get(v,0)+1
    return {"total_questions":total,"questions_by_major":majors,"questions_by_year":years,
            "questions_by_office":offices_count,"questions_by_nationality":nationalities,
            "indexed_chunks":doc_count(),"cached_answers":len(_answer_cache),
            "recent_questions":[e["question"] for e in stats_log[-5:]],"all_questions":all_questions}


# ── Backward compat stubs ─────────────────────────────────
def get_vectorstore(): return None
def get_embeddings():  return None