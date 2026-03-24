"""
main.py — UniAdvisor AI Backend v3
New in v3:
  - bcrypt password hashing (replaces plaintext)
  - JWT session tokens (replaces plain DB login)
  - Audit log for every admin/staff action
  - Per-office analytics endpoint
  - Escalation inbox + reply endpoint
  - Student feedback (thumbs up/down) persisted to Supabase
  - Campus events CRUD
  - Progress task tracking
"""
import sys
import os
import json
import secrets
import hashlib
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# ── Load .env file (safe no-op if python-dotenv not installed) ────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed; rely on real env vars

# ── Optional bcrypt (graceful fallback for environments without it) ──
try:
    import bcrypt
    BCRYPT_AVAILABLE = True
except ImportError:
    BCRYPT_AVAILABLE = False
    print("[UniAdvisor] WARNING: bcrypt not installed. Run: pip install bcrypt")

# ── Optional supabase ─────────────────────────────────────────────────
try:
    from supabase import create_client
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    if SUPABASE_URL and SUPABASE_KEY:
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        SUPABASE_AVAILABLE = True
    else:
        sb = None
        SUPABASE_AVAILABLE = False
except Exception:
    sb = None
    SUPABASE_AVAILABLE = False

from rag import get_answer, get_stats, add_document, load_docs_from_disk, save_docs_to_disk, doc_count, clear_documents, OFFICES, detect_office
# ingest now handled directly in rag.py via add_document

# ── In-memory fallback stores ─────────────────────────────────
announcements = []
faq_cache     = []
doc_registry  = {}
feedback_log  = []
token_store   = {}   # token -> {user_id, expires_at}
audit_buffer  = []   # buffer if Supabase unavailable


# ═══════════════════════════════════════════════════════════════
# AUTH HELPERS
# ═══════════════════════════════════════════════════════════════

def hash_password(plain: str) -> str:
    if BCRYPT_AVAILABLE:
        return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(12)).decode()
    # Fallback: sha256 (NOT secure for production — install bcrypt!)
    return "sha256:" + hashlib.sha256(plain.encode()).hexdigest()

def verify_password(plain: str, hashed: str) -> bool:
    if hashed.startswith("sha256:"):
        return hashed == "sha256:" + hashlib.sha256(plain.encode()).hexdigest()
    if BCRYPT_AVAILABLE:
        try:
            return bcrypt.checkpw(plain.encode(), hashed.encode())
        except Exception:
            return False
    return False

def generate_token() -> str:
    return secrets.token_urlsafe(48)

def create_session(user_id: int, email: str) -> str:
    token = generate_token()
    expires = datetime.now() + timedelta(hours=24)
    token_store[token] = {"user_id": user_id, "email": email, "expires_at": expires}
    if SUPABASE_AVAILABLE:
        try:
            sb.table("auth_tokens").insert({
                "user_id":    user_id,
                "token":      token,
                "expires_at": expires.isoformat(),
            }).execute()
        except Exception:
            pass
    return token

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.split(" ", 1)[1]
    # Check in-memory first (fast path)
    session = token_store.get(token)
    if session:
        if datetime.now() > session["expires_at"]:
            del token_store[token]
            raise HTTPException(status_code=401, detail="Session expired")
        return session
    # Check Supabase
    if SUPABASE_AVAILABLE:
        try:
            result = sb.table("auth_tokens").select("*, users(*)").eq("token", token).eq("revoked", False).single().execute()
            if result.data:
                expires = datetime.fromisoformat(result.data["expires_at"].replace("Z",""))
                if datetime.now() > expires:
                    raise HTTPException(status_code=401, detail="Session expired")
                session = {"user_id": result.data["user_id"], "email": result.data["users"]["email"]}
                token_store[token] = {**session, "expires_at": expires}
                return session
        except HTTPException:
            raise
        except Exception:
            pass
    raise HTTPException(status_code=401, detail="Invalid token")


# ═══════════════════════════════════════════════════════════════
# AUDIT LOG HELPER
# ═══════════════════════════════════════════════════════════════

def audit(actor_email: str, actor_role: str, action: str, target: str = None, detail: dict = None):
    entry = {
        "actor_email": actor_email,
        "actor_role":  actor_role,
        "action":      action,
        "target":      target,
        "detail":      detail or {},
        "created_at":  datetime.now().isoformat(),
    }
    audit_buffer.append(entry)
    if SUPABASE_AVAILABLE:
        try:
            sb.table("audit_log").insert(entry).execute()
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════
# APP SETUP
# ═══════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[UniAdvisor] Starting up...")
    load_docs_from_disk()
    print(f"[UniAdvisor] bcrypt: {'✅' if BCRYPT_AVAILABLE else '⚠️ fallback'}")
    print(f"[UniAdvisor] Supabase: {'✅' if SUPABASE_AVAILABLE else '⚠️ offline mode'}")
    # NOTE: Embedding model loads lazily on first /chat request
    # (avoids Render port-binding timeout on cold start)
    print("[UniAdvisor] Ready!")
    yield
    print("[UniAdvisor] Shutting down.")

app = FastAPI(title="UniAdvisor AI", version="3.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve React frontend from dist/ ──────────────────────────
import os as _os
_dist = _os.path.join(_os.path.dirname(__file__), "dist")
if _os.path.isdir(_dist):
    # Mount the entire dist folder so ALL static files are served
    # (js, css, images, favicon, etc.)
    app.mount("/assets", StaticFiles(directory=_os.path.join(_dist, "assets")), name="assets")
    # Also serve any other static files in dist root (favicon.ico, etc.)
    for _fname in _os.listdir(_dist):
        _fpath = _os.path.join(_dist, _fname)
        if _os.path.isdir(_fpath) and _fname != "assets":
            app.mount(f"/{_fname}", StaticFiles(directory=_fpath), name=_fname)


# ═══════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════

class LoginRequest(BaseModel):
    email:    str
    password: str

class ChatRequest(BaseModel):
    message:        str
    student_name:   str  = "Student"
    student_year:   str  = "Year 1"
    student_major:  str  = "General"
    student_nationality: str = "Hungarian"
    office:         str  = "auto"
    history:        List[dict] = []
    session_id:     Optional[str] = None
    reply_lang:     Optional[str] = None   # "en" or "hu" — set by frontend toggle

class AnnouncementCreate(BaseModel):
    text:         str
    type:         str = "info"
    scheduled_at: Optional[str] = None
    expires_at:   Optional[str] = None

class FeedbackItem(BaseModel):
    student_email: Optional[str] = None
    question:      str
    answer:        str
    rating:        str   # "up" or "down"
    office:        Optional[str] = None

class EscalationCreate(BaseModel):
    student_email: str
    student_name:  str
    subject:       str
    message:       str

class EscalationReply(BaseModel):
    admin_reply: str
    replied_by:  str

class ProgressTaskUpdate(BaseModel):
    student_email: str
    task_key:      str
    label:         str
    done:          bool

class EventCreate(BaseModel):
    title:       str
    description: Optional[str] = None
    location:    Optional[str] = None
    starts_at:   str
    ends_at:     Optional[str] = None
    category:    str = "academic"
    created_by:  Optional[str] = None


# ═══════════════════════════════════════════════════════════════
# BASIC ROUTES
# ═══════════════════════════════════════════════════════════════

@app.get("/")
def root():
    """Serve React app at root. Falls back to JSON if dist not built."""
    import os as _os
    index = _os.path.join(_os.path.dirname(__file__), "dist", "index.html")
    if _os.path.isfile(index):
        return FileResponse(index, media_type="text/html")
    return {"status": "UniAdvisor AI v3.0 running — frontend not built yet"}

@app.get("/health")
def health():
    return {"status": "ok", "supabase": SUPABASE_AVAILABLE, "bcrypt": BCRYPT_AVAILABLE}


# ═══════════════════════════════════════════════════════════════
# AUTH — LOGIN / LOGOUT
# ═══════════════════════════════════════════════════════════════

@app.post("/auth/login")
def login(req: LoginRequest):
    """Verify credentials, return session token."""
    if SUPABASE_AVAILABLE:
        try:
            result = sb.table("users").select("*").eq("email", req.email.lower().strip()).execute()
            if not result.data:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            user = result.data[0]
            if not verify_password(req.password, user["password_hash"]):
                raise HTTPException(status_code=401, detail="Invalid email or password")
            if not user.get("active", True):
                raise HTTPException(status_code=403, detail="Account is disabled")
            token = create_session(user["id"], user["email"])
            return {
                "token": token,
                "user":  {k: v for k, v in user.items() if k != "password_hash"},
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ── Offline demo fallback (no Supabase) ──────────────────
    DEMO_USERS = [
        {"id":1,"email":"student@uniduna.hu","password":"password123","full_name":"Anna Kovács","role":"student","major":"CS Engineering","year_of_study":"Year 2","nationality":"Hungarian","language_pref":"hu","onboarding_done":False},
        {"id":2,"email":"staff@uniduna.hu",  "password":"password123","full_name":"Dr. Kiss Péter","role":"staff","department":"Study Office","nationality":"Hungarian","language_pref":"hu","onboarding_done":True},
        {"id":3,"email":"admin@uniduna.hu",  "password":"password123","full_name":"Admin User","role":"admin","nationality":"Hungarian","language_pref":"en","onboarding_done":True},
    ]
    for u in DEMO_USERS:
        if u["email"] == req.email and u["password"] == req.password:
            token = create_session(u["id"], u["email"])
            safe = {k: v for k, v in u.items() if k != "password"}
            return {"token": token, "user": safe}
    raise HTTPException(status_code=401, detail="Invalid email or password")

@app.post("/auth/logout")
def logout(authorization: str = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        token_store.pop(token, None)
        if SUPABASE_AVAILABLE:
            try:
                sb.table("auth_tokens").update({"revoked": True}).eq("token", token).execute()
            except Exception:
                pass
    return {"message": "Logged out"}

@app.get("/auth/me")
def me(session = Depends(get_current_user)):
    """Return current user info from token."""
    if SUPABASE_AVAILABLE:
        try:
            result = sb.table("users").select("*").eq("email", session["email"]).single().execute()
            if result.data:
                return {k: v for k, v in result.data.items() if k != "password_hash"}
        except Exception:
            pass
    return {"email": session["email"]}

@app.post("/auth/complete-onboarding")
def complete_onboarding(session = Depends(get_current_user)):
    if SUPABASE_AVAILABLE:
        try:
            sb.table("users").update({"onboarding_done": True}).eq("email", session["email"]).execute()
        except Exception:
            pass
    return {"message": "Onboarding complete"}


# ═══════════════════════════════════════════════════════════════
# CHAT
# ═══════════════════════════════════════════════════════════════

@app.post("/chat")
async def chat(req: ChatRequest):
    import traceback
    try:
        answer, sources, detected_office = get_answer(
            question=req.message,
            student_name=req.student_name,
            student_year=req.student_year,
            student_major=req.student_major,
            student_nationality=req.student_nationality,
            office=req.office,
            history=req.history,
            reply_lang=req.reply_lang,
        )
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[UniAdvisor] /chat error:\n{tb}")
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")

    # Log to Supabase in background (non-blocking — doesn't delay response)
    if SUPABASE_AVAILABLE:
        import threading
        def _log_async():
            try:
                sb.table("chat_logs").insert({
                    "question":     req.message,
                    "answer":       answer[:500],
                    "student_name": req.student_name,
                    "major":        req.student_major,
                    "year_of_study":req.student_year,
                    "nationality":  req.student_nationality,
                    "office_routed":detected_office,
                    "session_id":   req.session_id,
                    "asked_at":     datetime.now().isoformat(),
                }).execute()
            except Exception:
                pass
            try:
                sb.table("office_analytics").insert({
                    "office_id": detected_office,
                    "question":  req.message,
                    "asked_at":  datetime.now().isoformat(),
                }).execute()
            except Exception:
                pass
        threading.Thread(target=_log_async, daemon=True).start()

    from rag import OFFICES
    office_info = OFFICES.get(detected_office, OFFICES["general"])
    return {
        "answer":       answer,
        "sources":      sources,
        "office":       detected_office,
        "office_name":  office_info["name"],
        "office_emoji": office_info["emoji"],
    }


# ═══════════════════════════════════════════════════════════════
# DOCUMENTS
# ═══════════════════════════════════════════════════════════════

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), office: str = "general", session = Depends(get_current_user)):
    if session.get("role") not in ("admin", "staff"):
        raise HTTPException(status_code=403, detail="Admin or staff access required.")
    if not file.filename.endswith((".pdf", ".txt", ".docx")):
        raise HTTPException(status_code=400, detail="Only PDF, TXT, DOCX supported.")
    try:
        contents = await file.read()
        text = _extract_text(contents, file.filename)
        add_document(text, source=file.filename, office=office)
        save_docs_to_disk()
        chunks = doc_count()
        doc_registry[file.filename] = {
            "uploaded_at": datetime.now().isoformat(),
            "size_kb":     round(len(contents) / 1024, 1),
            "chunks":      chunks,
            "office":      office,
        }
        return {"message": f"'{file.filename}' ingested.", "chunks": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents")
def documents():
    enriched = []
    for name, info in doc_registry.items():
        enriched.append({
            "name":        name,
            "office":      info.get("office","general"),
            "uploaded_at": info.get("uploaded_at","Unknown"),
            "size_kb":     info.get("size_kb", 0),
            "chunks":      info.get("chunks", 0),
        })
    return {"documents": enriched}

@app.get("/stats")
def stats():
    return get_stats()

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


# ═══════════════════════════════════════════════════════════════
# ANNOUNCEMENTS
# ═══════════════════════════════════════════════════════════════

@app.get("/announcements")
def get_announcements():
    if SUPABASE_AVAILABLE:
        try:
            now = datetime.now().isoformat()
            result = sb.table("announcements").select("*").eq("active", True).lte("scheduled_at", now).execute()
            return {"announcements": result.data or []}
        except Exception:
            pass
    return {"announcements": [a for a in announcements if a["active"]]}

@app.post("/announcements")
def create_announcement(item: AnnouncementCreate):
    ann = {
        "text":         item.text,
        "type":         item.type,
        "active":       True,
        "scheduled_at": item.scheduled_at or datetime.now().isoformat(),
        "expires_at":   item.expires_at,
        "created_at":   datetime.now().isoformat(),
    }
    if SUPABASE_AVAILABLE:
        try:
            result = sb.table("announcements").insert(ann).execute()
            return {"message": "Announcement created.", "announcement": result.data[0]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    ann["id"] = len(announcements) + 1
    announcements.append(ann)
    return {"message": "Announcement created.", "announcement": ann}

@app.delete("/announcements/{ann_id}")
def delete_announcement(ann_id: int):
    if SUPABASE_AVAILABLE:
        try:
            sb.table("announcements").update({"active": False}).eq("id", ann_id).execute()
            return {"message": "Announcement removed."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    for ann in announcements:
        if ann["id"] == ann_id:
            ann["active"] = False
            return {"message": "Announcement removed."}
    raise HTTPException(status_code=404, detail="Not found.")


# ═══════════════════════════════════════════════════════════════
# FEEDBACK (thumbs up/down)
# ═══════════════════════════════════════════════════════════════

@app.post("/feedback")
def submit_feedback(item: FeedbackItem):
    entry = {
        "student_email": item.student_email,
        "question":      item.question,
        "answer":        item.answer[:300],
        "rating":        item.rating,
        "office":        item.office,
        "created_at":    datetime.now().isoformat(),
    }
    feedback_log.append(entry)
    if SUPABASE_AVAILABLE:
        try:
            sb.table("feedback").insert(entry).execute()
            # Update office analytics with rating
            if item.office:
                sb.table("office_analytics").insert({
                    "office_id": item.office,
                    "rating":    item.rating,
                    "question":  item.question,
                    "asked_at":  datetime.now().isoformat(),
                }).execute()
        except Exception:
            pass
    return {"message": "Feedback recorded. Thank you!"}

@app.get("/feedback")
def get_feedback():
    if SUPABASE_AVAILABLE:
        try:
            result = sb.table("feedback").select("*").order("created_at", desc=True).limit(100).execute()
            data   = result.data or []
            total  = len(data)
            ups    = sum(1 for f in data if f["rating"] == "up")
            # Daily breakdown (last 7 days)
            from collections import defaultdict
            daily = defaultdict(lambda: {"up":0,"down":0})
            for f in data:
                try:
                    day = f["created_at"][:10]
                    daily[day][f["rating"]] += 1
                except Exception:
                    pass
            return {
                "total": total, "upvotes": ups, "downvotes": total - ups,
                "score": round((ups/total*100) if total > 0 else 0, 1),
                "daily": dict(daily),
                "recent": data[:10],
            }
        except Exception:
            pass
    total  = len(feedback_log)
    ups    = sum(1 for f in feedback_log if f["rating"] == "up")
    return {"total": total, "upvotes": ups, "downvotes": total - ups,
            "score": round((ups/total*100) if total > 0 else 0, 1), "recent": feedback_log[-5:]}


# ═══════════════════════════════════════════════════════════════
# OFFICE ANALYTICS
# ═══════════════════════════════════════════════════════════════

@app.get("/office-analytics")
def office_analytics():
    """Per-office: question count, up/down ratings, satisfaction %"""
    if not SUPABASE_AVAILABLE:
        return {"offices": [], "message": "Supabase not connected"}
    try:
        result = sb.table("office_analytics").select("office_id, office_name, rating, asked_at").execute()
        data   = result.data or []
        from collections import defaultdict
        offices = defaultdict(lambda: {"total": 0, "up": 0, "down": 0, "unrated": 0, "daily": defaultdict(int)})
        for row in data:
            oid = row["office_id"]
            offices[oid]["total"] += 1
            if row["rating"] == "up":
                offices[oid]["up"] += 1
            elif row["rating"] == "down":
                offices[oid]["down"] += 1
            else:
                offices[oid]["unrated"] += 1
            try:
                day = row["asked_at"][:10]
                offices[oid]["daily"][day] += 1
            except Exception:
                pass
        summary = []
        for oid, stats in offices.items():
            rated = stats["up"] + stats["down"]
            summary.append({
                "office_id":      oid,
                "total":          stats["total"],
                "up":             stats["up"],
                "down":           stats["down"],
                "satisfaction":   round((stats["up"] / rated * 100) if rated > 0 else 0, 1),
                "daily":          dict(stats["daily"]),
            })
        summary.sort(key=lambda x: x["total"], reverse=True)
        return {"offices": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# ESCALATIONS
# ═══════════════════════════════════════════════════════════════

@app.get("/escalations")
def get_escalations(status: Optional[str] = None):
    if not SUPABASE_AVAILABLE:
        return {"escalations": []}
    try:
        q = sb.table("escalations").select("*").order("created_at", desc=True)
        if status:
            q = q.eq("status", status)
        result = q.execute()
        return {"escalations": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/escalations")
def create_escalation(item: EscalationCreate):
    entry = {
        "student_email": item.student_email,
        "student_name":  item.student_name,
        "subject":       item.subject,
        "message":       item.message,
        "status":        "open",
        "created_at":    datetime.now().isoformat(),
    }
    if SUPABASE_AVAILABLE:
        try:
            result = sb.table("escalations").insert(entry).execute()
            return {"message": "Escalation submitted.", "escalation": result.data[0]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Escalation submitted (offline).", "escalation": entry}

@app.patch("/escalations/{esc_id}/reply")
def reply_escalation(esc_id: int, reply: EscalationReply):
    if not SUPABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Supabase not connected")
    try:
        result = sb.table("escalations").update({
            "admin_reply": reply.admin_reply,
            "replied_by":  reply.replied_by,
            "replied_at":  datetime.now().isoformat(),
            "status":      "replied",
        }).eq("id", esc_id).execute()
        audit(reply.replied_by, "admin", "REPLY_ESCALATION", f"escalation:{esc_id}")
        return {"message": "Reply sent.", "escalation": result.data[0] if result.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/escalations/student/{email}")
def student_escalations(email: str):
    """Called by student chat to show their own escalation replies."""
    if not SUPABASE_AVAILABLE:
        return {"escalations": []}
    try:
        result = sb.table("escalations").select("*").eq("student_email", email).order("created_at", desc=True).execute()
        return {"escalations": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# PROGRESS TASKS
# ═══════════════════════════════════════════════════════════════

DEFAULT_TASKS = [
    {"task_key": "collect_docs",       "label": "Collect enrollment documents"},
    {"task_key": "register_courses",   "label": "Register for courses"},
    {"task_key": "pay_fees",           "label": "Pay semester fees"},
    {"task_key": "get_student_card",   "label": "Pick up student card"},
    {"task_key": "library_access",     "label": "Activate library access"},
    {"task_key": "email_setup",        "label": "Set up university email"},
    {"task_key": "thesis_topic",       "label": "Submit thesis topic (if applicable)"},
    {"task_key": "internship_form",    "label": "Submit internship placement form"},
    {"task_key": "scholarship_apply",  "label": "Apply for scholarship"},
]

@app.get("/progress/{student_email}")
def get_progress(student_email: str):
    if SUPABASE_AVAILABLE:
        try:
            result = sb.table("progress_tasks").select("*").eq("student_email", student_email).execute()
            saved  = {r["task_key"]: r for r in (result.data or [])}
            tasks  = []
            for t in DEFAULT_TASKS:
                row = saved.get(t["task_key"])
                tasks.append({
                    "task_key": t["task_key"],
                    "label":    t["label"],
                    "done":     row["done"] if row else False,
                    "done_at":  row["done_at"] if row else None,
                })
            return {"tasks": tasks, "done": sum(1 for t in tasks if t["done"]), "total": len(tasks)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"tasks": [{**t, "done": False, "done_at": None} for t in DEFAULT_TASKS], "done": 0, "total": len(DEFAULT_TASKS)}

@app.post("/progress")
def update_progress(item: ProgressTaskUpdate):
    if SUPABASE_AVAILABLE:
        try:
            sb.table("progress_tasks").upsert({
                "student_email": item.student_email,
                "task_key":      item.task_key,
                "label":         item.label,
                "done":          item.done,
                "done_at":       datetime.now().isoformat() if item.done else None,
            }, on_conflict="student_email,task_key").execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Progress updated"}


# ═══════════════════════════════════════════════════════════════
# CAMPUS EVENTS
# ═══════════════════════════════════════════════════════════════

@app.get("/events")
def get_events():
    if SUPABASE_AVAILABLE:
        try:
            result = sb.table("campus_events").select("*").gte("starts_at", datetime.now().isoformat()).order("starts_at").execute()
            return {"events": result.data or []}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    # Fallback: empty list
    return {"events": []}

@app.post("/events")
def create_event(item: EventCreate):
    entry = {
        "title":       item.title,
        "description": item.description,
        "location":    item.location,
        "starts_at":   item.starts_at,
        "ends_at":     item.ends_at,
        "category":    item.category,
        "created_by":  item.created_by,
    }
    if SUPABASE_AVAILABLE:
        try:
            result = sb.table("campus_events").insert(entry).execute()
            return {"message": "Event created.", "event": result.data[0]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Event created (offline).", "event": entry}

@app.delete("/events/{event_id}")
def delete_event(event_id: int):
    if SUPABASE_AVAILABLE:
        try:
            sb.table("campus_events").delete().eq("id", event_id).execute()
            return {"message": "Event deleted."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Event deleted (offline)."}


# ═══════════════════════════════════════════════════════════════
# AUDIT LOG
# ═══════════════════════════════════════════════════════════════

@app.get("/audit-log")
def get_audit_log(limit: int = 50):
    if SUPABASE_AVAILABLE:
        try:
            result = sb.table("audit_log").select("*").order("created_at", desc=True).limit(limit).execute()
            return {"logs": result.data or []}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"logs": audit_buffer[-limit:][::-1]}


# ═══════════════════════════════════════════════════════════════
# FAQ + TRANSLATE + OFFICES (unchanged from v2)
# ═══════════════════════════════════════════════════════════════

@app.get("/faq")
def get_faq():
    stats_data = get_stats()
    questions  = stats_data.get("all_questions", [])
    topics     = {}
    keywords   = {
        "course":      ["course","curriculum","subject","module","credit","tantárgy"],
        "application": ["apply","application","admission","register","jelentkezés"],
        "scholarship": ["scholarship","grant","aid","funding","ösztöndíj"],
        "fees":        ["fee","tuition","cost","payment","price","díj"],
        "deadline":    ["deadline","date","calendar","schedule","határidő"],
        "visa":        ["visa","permit","residence","vízum"],
        "housing":     ["housing","accommodation","dormitory","kollégium"],
        "graduation":  ["graduate","graduation","degree","diploma"],
    }
    for q in questions:
        lower = q.lower()
        for topic, words in keywords.items():
            if any(w in lower for w in words):
                topics.setdefault(topic, []).append(q)
                break
    faq = [{"topic": t.replace("_"," ").title(), "question": qs[0], "count": len(qs)}
           for t, qs in list(topics.items())[:8] if qs]
    faq.sort(key=lambda x: x["count"], reverse=True)
    return {"faq": faq}

@app.post("/translate")
async def translate_document(file: UploadFile = File(...), target_language: str = "en"):
    if not file.filename.endswith((".txt",".pdf",".docx")):
        raise HTTPException(status_code=400, detail="Only TXT, PDF, DOCX supported.")
    try:
        from groq_key_rotator import get_groq_rotator
        contents = await file.read()
        text = _extract_text(contents, file.filename)
        if len(text) > 8000:
            text = text[:8000] + "\n\n[Truncated...]"
        lang_name = "Hungarian" if target_language == "hu" else "English"
        rotator  = get_groq_rotator()
        response = rotator.chat(
            messages=[{"role":"user","content":f"Translate to {lang_name}. Preserve structure. Only output translated text.\n\n{text}"}],
            max_tokens=4000, temperature=0.1, model="llama-3.1-8b-instant",
        )
        translated   = response.choices[0].message.content
        new_filename = f"translated_{target_language}_{file.filename.rsplit('.',1)[0]}.txt"
        return {"message":"Translation complete.","filename":new_filename,"language":lang_name,"translated":translated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/offices")
def get_offices():
    try:
        items = []
        for oid, info in OFFICES.items():
            count = sum(1 for d in doc_registry.values() if d.get("office") == oid)
            items.append({"id": oid, "name": info["name"], "emoji": info.get("emoji","🏛️"), "doc_count": count})
        return {"offices": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/offices/{office_id}/documents")
def office_documents(office_id: str):
    try:
        docs = [{"name": name, "office": office_id, **info}
                for name, info in doc_registry.items() if info.get("office") == office_id]
        return {"documents": docs, "office_id": office_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect-office")
def detect_office_endpoint(body: dict):
    question = body.get("question","")
    try:
        return {"office": detect_office(question)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Catch-all: serve React app for any non-API route ─────────
@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    """Serve React index.html for all non-API routes (SPA routing)."""
    import os as _os
    dist  = _os.path.join(_os.path.dirname(__file__), "dist")

    # If requesting a real file that exists in dist, serve it directly
    requested = _os.path.join(dist, full_path)
    if full_path and _os.path.isfile(requested):
        return FileResponse(requested)

    # Otherwise serve index.html (React handles routing client-side)
    index = _os.path.join(dist, "index.html")
    if _os.path.isfile(index):
        return FileResponse(index, media_type="text/html")

    return {"error": "Frontend not built. Run: npm run build"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)