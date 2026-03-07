import sys
import os
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from rag import get_answer, get_stats, get_embeddings, get_vectorstore, detect_office, OFFICES as RAG_OFFICES
from ingest import ingest_document, list_documents, list_documents_by_office, purge_bad_documents, OFFICES

# ── In-memory stores ──────────────────────────────────────
announcements   = []
doc_registry    = {}
feedback_log    = []
deadlines_store = []
escalations     = []
corrections     = {}    # keyed by question hash → corrected answer


def _seed_deadlines():
    from datetime import timedelta
    seeds = [
        {"title": "Course Registration Deadline", "date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%dT23:59:00"),  "category": "registration", "description": "Last day to register for next semester courses"},
        {"title": "Scholarship Application Close", "date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%dT23:59:00"),  "category": "scholarship", "description": "Submit all documents to the financial aid office"},
        {"title": "Midterm Exam Period Begins",    "date": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%dT08:00:00"), "category": "exam",         "description": "Check your personal exam schedule"},
        {"title": "Tuition Fee Payment Due",       "date": (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%dT23:59:00"), "category": "general",      "description": "Payment via bank transfer or student portal"},
        {"title": "Thesis Submission Deadline",    "date": (datetime.now() + timedelta(days=45)).strftime("%Y-%m-%dT23:59:00"), "category": "exam",         "description": "Final thesis upload to the student system"},
    ]
    for s in seeds:
        s["id"] = len(deadlines_store) + 1
        s["created_at"] = datetime.now().isoformat()
        deadlines_store.append(s)



@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[UniAdvisor] Starting up...")
    get_embeddings()
    get_vectorstore()
    # Auto-purge any accidentally indexed system files on every startup
    bad = purge_bad_documents()
    if bad:
        print(f"[UniAdvisor] Auto-purged bad entries: {bad}")
    _seed_deadlines()
    print("[UniAdvisor] Ready!")
    yield

app = FastAPI(title="UniAdvisor AI", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/chat-debug")
async def chat_debug(request: Request):
    body = await request.body()
    try:
        import json
        parsed = json.loads(body)
    except Exception as e:
        parsed = f"INVALID JSON: {e}"
    print("[DEBUG BODY]", body.decode("utf-8", errors="replace"))
    return {"raw": body.decode("utf-8", errors="replace"), "parsed": parsed}


# ── Pydantic models ───────────────────────────────────────
class ChatRequest(BaseModel):
    message:       str
    student_name:  str = "Student"
    student_year:  str = "Year 1"
    student_major: str = "General"
    history:       List[dict] = []
    office:        str = "auto"   # "auto" = AI detects, or explicit office id

    class Config:
        extra = "allow"

class AnnouncementCreate(BaseModel):
    text: str
    type: str = "info"

class FeedbackItem(BaseModel):
    question: str
    answer:   str
    rating:   str

class DeadlineCreate(BaseModel):
    title:      str
    date:       str          # ISO string e.g. "2025-05-15T23:59:00"
    category:   str = "general"   # registration | exam | scholarship | general
    description: str = ""

class EscalationRequest(BaseModel):
    student_email: str
    student_name:  str
    question:      str
    ai_answer:     str
    reason:        str = "I need more help"

class AnswerCorrection(BaseModel):
    question:         str
    original_answer:  str
    corrected_answer: str
    corrected_by:     str = "admin"

# ── Health ────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "UniAdvisor AI v2.0 running"}

@app.get("/health")
def health():
    return {"status": "ok"}

# ── Offices ────────────────────────────────────────────────
@app.get("/offices")
def get_offices():
    """Return list of all offices with their metadata and document counts."""
    docs = list_documents()
    doc_counts = {}
    for d in docs:
        o = d.get("office","general")
        doc_counts[o] = doc_counts.get(o, 0) + 1
    return {
        "offices": [
            {
                "id":         oid,
                "name":       info["name"],
                "emoji":      info["emoji"],
                "doc_count":  doc_counts.get(oid, 0),
                "keywords":   info["keywords"][:5],
            }
            for oid, info in OFFICES.items()
        ]
    }

@app.get("/offices/{office_id}/documents")
def get_office_documents(office_id: str):
    """Documents uploaded by a specific office."""
    docs = list_documents_by_office(office_id)
    return {"office": office_id, "documents": docs}

@app.post("/detect-office")
async def detect_office_endpoint(body: dict):
    """Given a question, return which office it belongs to."""
    question = body.get("question","")
    office   = detect_office(question)
    info     = RAG_OFFICES.get(office, {})
    return {"office": office, "office_name": info.get("name",""), "office_emoji": info.get("emoji","🏛️")}

# ── Chat ──────────────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        import hashlib
        history_dicts = [{"role": str(m.get("role","user")), "content": str(m.get("content",""))} for m in req.history if m.get("content") and m.get("content") != "typing"]

        # Check if admin has corrected this question
        q_key = hashlib.md5(req.message.lower().strip().encode()).hexdigest()
        if q_key in corrections:
            corrected = corrections[q_key]
            return {
                "answer":     corrected["corrected_answer"],
                "sources":    [],
                "corrected":  True,
                "corrected_by": corrected["corrected_by"],
            }

        answer, sources, detected_office = get_answer(
            question      = req.message,
            student_name  = req.student_name,
            student_year  = req.student_year,
            student_major = req.student_major,
            history       = history_dicts,
            office        = req.office,
        )
        office_info = RAG_OFFICES.get(detected_office, {})
        return {
            "answer":       answer,
            "sources":      sources,
            "corrected":    False,
            "office":       detected_office,
            "office_name":  office_info.get("name", detected_office),
            "office_emoji": office_info.get("emoji", "🏛️"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Upload ────────────────────────────────────────────────
ALLOWED_EXT = {".pdf", ".txt", ".docx"}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), office: str = Form("general")):
    filename = file.filename or ""
    ext      = os.path.splitext(filename)[1].lower()

    # Block non-document files and dotfiles
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400,
            detail=f"Only PDF, TXT, DOCX allowed. Received: '{filename}'")
    if filename.startswith(".") or filename.lower() in {".env", "env"}:
        raise HTTPException(status_code=400, detail="System files cannot be uploaded.")

    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="File is empty.")
        result = ingest_document(contents, filename, office=office)
        doc_registry[filename] = {
            "uploaded_at": datetime.now().isoformat(),
            "size_kb":     round(len(contents) / 1024, 1),
            "chunks":      result["chunks"],
            "office":      office,
            "office_name": OFFICES.get(office, {}).get("name", office),
        }
        return {
            "message": f"'{filename}' indexed successfully. ({result['chunks']} chunks)",
            "chunks":  result["chunks"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")

# ── Documents list ────────────────────────────────────────
@app.get("/documents")
def documents():
    docs = list_documents()
    return {"documents": [
        {
            "name":        d,
            "uploaded_at": doc_registry.get(d, {}).get("uploaded_at", "Unknown"),
            "size_kb":     doc_registry.get(d, {}).get("size_kb", 0),
            "chunks":      doc_registry.get(d, {}).get("chunks", 0),
        } for d in docs
    ]}

# ── Stats ─────────────────────────────────────────────────
@app.get("/stats")
def stats():
    return get_stats()

# ── Announcements ─────────────────────────────────────────
@app.get("/announcements")
def get_announcements():
    return {"announcements": [a for a in announcements if a["active"]]}

@app.post("/announcements")
def create_announcement(item: AnnouncementCreate):
    ann = {
        "id":         len(announcements) + 1,
        "text":       item.text,
        "type":       item.type,
        "created_at": datetime.now().isoformat(),
        "active":     True,
    }
    announcements.append(ann)
    return {"message": "Announcement created.", "announcement": ann}

@app.delete("/announcements/{ann_id}")
def delete_announcement(ann_id: int):
    for ann in announcements:
        if ann["id"] == ann_id:
            ann["active"] = False
            return {"message": "Removed."}
    raise HTTPException(status_code=404, detail="Not found.")

# ── Smart FAQ ─────────────────────────────────────────────
@app.get("/faq")
def get_faq():
    all_questions = get_stats().get("all_questions", [])
    keywords = {
        "Courses":     ["course","curriculum","subject","module","credit","tantárgy"],
        "Application": ["apply","application","admission","register","jelentkezés"],
        "Scholarship": ["scholarship","grant","aid","funding","ösztöndíj"],
        "Fees":        ["fee","tuition","cost","payment","díj"],
        "Deadlines":   ["deadline","date","calendar","schedule","határidő"],
        "Visa":        ["visa","permit","residence","vízum"],
        "Housing":     ["housing","accommodation","dormitory","kollégium"],
        "Graduation":  ["graduate","graduation","degree","diploma"],
    }
    topics = {}
    for q in all_questions:
        lower = q.lower()
        for topic, words in keywords.items():
            if any(w in lower for w in words):
                topics.setdefault(topic, []).append(q)
                break
    faq = sorted(
        [{"topic": k, "question": v[0], "count": len(v)} for k, v in topics.items()],
        key=lambda x: x["count"], reverse=True
    )
    return {"faq": faq[:8]}

# ── Expiry alerts ─────────────────────────────────────────
@app.get("/expiry-alerts")
def get_expiry_alerts():
    alerts = []
    for name, info in doc_registry.items():
        try:
            uploaded = datetime.fromisoformat(info["uploaded_at"])
            days_old = (datetime.now() - uploaded).days
            if days_old >= 90:
                alerts.append({
                    "filename":    name,
                    "days_old":    days_old,
                    "uploaded_at": info["uploaded_at"],
                    "severity":    "high" if days_old >= 180 else "medium",
                })
        except Exception:
            pass
    return {"alerts": alerts, "total": len(alerts)}

# ── Auto-translate ────────────────────────────────────────
@app.post("/translate")
async def translate_document(file: UploadFile = File(...), target_language: str = "en"):
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Only TXT, PDF, DOCX supported.")
    try:
        from groq_key_rotator import get_groq_rotator
        from ingest import extract_text
        contents   = await file.read()
        text       = extract_text(contents, filename)
        if len(text) > 8000:
            text = text[:8000] + "\n\n[Truncated...]"
        lang_name  = "Hungarian" if target_language == "hu" else "English"
        rotator    = get_groq_rotator()
        response   = rotator.chat(
            messages=[{"role": "user", "content": f"Translate to {lang_name}. Output translated text only.\n\n{text}"}],
            max_tokens=4000, temperature=0.1, model="llama-3.1-8b-instant",
        )
        return {
            "message":    "Translation complete.",
            "translated": response.choices[0].message.content,
            "language":   lang_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Purge bad docs ────────────────────────────────────────
@app.post("/purge-bad-docs")
def purge_bad():
    """Remove any accidentally indexed system files (like .env) from ChromaDB."""
    removed = purge_bad_documents()
    return {"message": f"Purged {len(removed)} bad entries.", "removed": removed}

# ── Deadlines ─────────────────────────────────────────────
@app.get("/deadlines")
def get_deadlines():
    now = datetime.now().isoformat()
    active = [d for d in deadlines_store if d["date"] >= now]
    return {"deadlines": sorted(active, key=lambda x: x["date"])}

@app.post("/deadlines")
def create_deadline(item: DeadlineCreate):
    dl = {
        "id":          len(deadlines_store) + 1,
        "title":       item.title,
        "date":        item.date,
        "category":    item.category,
        "description": item.description,
        "created_at":  datetime.now().isoformat(),
    }
    deadlines_store.append(dl)
    return {"message": "Deadline created.", "deadline": dl}

@app.delete("/deadlines/{dl_id}")
def delete_deadline(dl_id: int):
    for dl in deadlines_store:
        if dl["id"] == dl_id:
            deadlines_store.remove(dl)
            return {"message": "Deleted."}
    raise HTTPException(status_code=404, detail="Not found.")

# Seed demo deadlines on startup (cleared each restart — production would use DB)

# ── Escalation ("Ask a real advisor") ────────────────────
@app.post("/escalate")
def escalate(item: EscalationRequest):
    esc = {
        "id":            len(escalations) + 1,
        "student_email": item.student_email,
        "student_name":  item.student_name,
        "question":      item.question,
        "ai_answer":     item.ai_answer,
        "reason":        item.reason,
        "status":        "pending",    # pending | responded | resolved
        "created_at":    datetime.now().isoformat(),
        "response":      None,
    }
    escalations.append(esc)
    return {"message": "Your request has been sent to an academic advisor. They will contact you within 1 business day.", "id": esc["id"]}

@app.get("/escalations")
def get_escalations(status: str = None):
    if status:
        return {"escalations": [e for e in escalations if e["status"] == status]}
    return {"escalations": escalations}

@app.patch("/escalations/{esc_id}/respond")
def respond_escalation(esc_id: int, body: dict):
    for e in escalations:
        if e["id"] == esc_id:
            e["response"] = body.get("response", "")
            e["status"]   = "responded"
            return {"message": "Response sent."}
    raise HTTPException(status_code=404, detail="Not found.")

# ── Answer corrections (human-in-the-loop) ───────────────
@app.post("/corrections")
def submit_correction(item: AnswerCorrection):
    import hashlib
    key = hashlib.md5(item.question.lower().strip().encode()).hexdigest()
    corrections[key] = {
        "question":        item.question,
        "original_answer": item.original_answer,
        "corrected_answer": item.corrected_answer,
        "corrected_by":    item.corrected_by,
        "corrected_at":    datetime.now().isoformat(),
    }
    return {"message": "Correction saved. Future answers for this question will use the corrected version.", "key": key}

@app.get("/corrections")
def get_corrections():
    return {"corrections": list(corrections.values()), "total": len(corrections)}

# ── Feedback ──────────────────────────────────────────────
@app.post("/feedback")
def submit_feedback(item: FeedbackItem):
    feedback_log.append({"question": item.question, "rating": item.rating, "created_at": datetime.now().isoformat()})
    return {"message": "Feedback recorded."}

@app.get("/feedback")
def get_feedback_stats():
    total   = len(feedback_log)
    upvotes = sum(1 for f in feedback_log if f["rating"] == "up")
    return {"total": total, "upvotes": upvotes, "downvotes": total - upvotes,
            "score": round((upvotes / total * 100) if total > 0 else 0, 1)}


# ── Office analytics (stub — uses existing stats) ─────────
@app.get("/office-analytics")
def office_analytics():
    s = get_stats()
    return {
        "by_office":   s.get("questions_by_office", {}),
        "total":       s.get("total_questions", 0),
        "offices":     list(RAG_OFFICES.keys()),
    }

# ── Audit log (stub) ──────────────────────────────────────
@app.get("/audit-log")
def audit_log():
    # Returns recent questions as a basic audit trail
    s = get_stats()
    return {"log": [{"action": "question", "detail": q, "ts": "—"} for q in s.get("recent_questions", [])]}

# ── Events (stub) ─────────────────────────────────────────
@app.get("/events")
def get_events():
    # Reuse deadlines as events
    now = datetime.now().isoformat()
    active = [d for d in deadlines_store if d["date"] >= now]
    return {"events": sorted(active, key=lambda x: x["date"])}


# ══════════════════════════════════════════════════════════════
# AUTH endpoints (JWT-lite — stateless, no library needed)
# ══════════════════════════════════════════════════════════════
import hashlib, base64, json as _json

_sessions: dict = {}   # token → user dict (in-memory; fine for single-process)

def _make_token(email: str) -> str:
    raw = f"{email}:{datetime.now().isoformat()}:{os.urandom(8).hex()}"
    return base64.urlsafe_b64encode(raw.encode()).decode()

async def _get_user_from_supabase(email: str, password: str):
    """Query Supabase users table directly via REST."""
    supa_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL", "")
    supa_key  = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
    if not supa_url or not supa_key:
        return None
    import httpx
    try:
        r = await httpx.AsyncClient().get(
            f"{supa_url}/rest/v1/users",
            params={"email": f"eq.{email}", "active": "eq.true", "select": "*"},
            headers={"apikey": supa_key, "Authorization": f"Bearer {supa_key}"},
            timeout=5,
        )
        rows = r.json()
        if isinstance(rows, list) and rows:
            u = rows[0]
            if u.get("password") == password:
                return u
    except Exception as e:
        print(f"[Auth] Supabase lookup failed: {e}")
    return None

@app.post("/auth/login")
async def auth_login(body: dict):
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    user = await _get_user_from_supabase(email, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _make_token(email)
    _sessions[token] = user
    return {"token": token, "user": user}

@app.get("/auth/me")
def auth_me(request: Request):
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    user  = _sessions.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@app.post("/auth/logout")
def auth_logout(request: Request):
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    _sessions.pop(token, None)
    return {"ok": True}

@app.post("/auth/complete-onboarding")
def complete_onboarding(request: Request):
    token = (request.headers.get("Authorization") or "").replace("Bearer ", "")
    user  = _sessions.get(token)
    if user:
        user["onboarding_done"] = True
    return {"ok": True}

# ══════════════════════════════════════════════════════════════
# PROGRESS TRACKER
# ══════════════════════════════════════════════════════════════
_progress: dict = {}   # email → {task_key: {...}}

_DEFAULT_TASKS = [
    {"task_key":"register_courses",   "label":"Register for courses"},
    {"task_key":"pay_tuition",        "label":"Pay tuition fee"},
    {"task_key":"upload_id",          "label":"Upload student ID"},
    {"task_key":"get_student_card",   "label":"Collect student card"},
    {"task_key":"library_card",       "label":"Activate library card"},
    {"task_key":"email_setup",        "label":"Set up university email"},
    {"task_key":"thesis_topic",       "label":"Submit thesis topic"},
    {"task_key":"dormitory_form",     "label":"Complete dormitory form"},
]

@app.get("/progress/{student_email}")
def get_progress(student_email: str):
    tasks_map = _progress.get(student_email, {})
    result = []
    for t in _DEFAULT_TASKS:
        saved = tasks_map.get(t["task_key"], {})
        result.append({**t, "done": saved.get("done", False), "done_at": saved.get("done_at")})
    done = sum(1 for r in result if r["done"])
    return {"tasks": result, "done": done, "total": len(result)}

@app.post("/progress")
def save_progress(body: dict):
    email    = body.get("student_email", "")
    task_key = body.get("task_key", "")
    done     = body.get("done", False)
    label    = body.get("label", "")
    if not email or not task_key:
        raise HTTPException(status_code=400, detail="student_email and task_key required")
    if email not in _progress:
        _progress[email] = {}
    _progress[email][task_key] = {
        "done":    done,
        "label":   label,
        "done_at": datetime.now().isoformat() if done else None,
    }
    return {"ok": True}

# ══════════════════════════════════════════════════════════════
# ESCALATIONS — student view + reply endpoint
# ══════════════════════════════════════════════════════════════
@app.get("/escalations/student/{student_email}")
def get_student_escalations(student_email: str):
    mine = [e for e in escalations if e.get("student_email","").lower() == student_email.lower()]
    return {"escalations": mine}

@app.patch("/escalations/{esc_id}/reply")
def reply_escalation(esc_id: int, body: dict):
    """AdminPortal uses /reply, old code used /respond — support both."""
    for e in escalations:
        if e["id"] == esc_id:
            e["admin_reply"]  = body.get("admin_reply") or body.get("response", "")
            e["replied_by"]   = body.get("replied_by") or body.get("corrected_by", "Admin")
            e["replied_at"]   = datetime.now().isoformat()
            e["status"]       = "replied"
            return {"ok": True, "escalation": e}
    raise HTTPException(status_code=404, detail="Escalation not found")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)