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

# ── Supabase ──────────────────────────────────────────────────────────
# The backend uses the service-role key: it bypasses row-level security,
# which is locked down so the public anon key can only read announcements.
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
if not SUPABASE_KEY:
    raise RuntimeError(
        "SUPABASE_SERVICE_ROLE_KEY environment variable is not set. The server will not start without it. "
        "Find it in Supabase under Project Settings > API (service_role key) and set it in your .env file "
        "or hosting dashboard. Never expose this key to the frontend."
    )
try:
    from supabase import create_client
    if SUPABASE_URL:
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

JWT_SECRET = os.getenv("JWT_SECRET", "")
if not JWT_SECRET or JWT_SECRET == "uniadvisor-secret-key-change-in-prod-2024":
    raise RuntimeError(
        "JWT_SECRET environment variable is not set (or is the old public default). "
        "The server will not start without it, because anyone could forge login tokens. "
        "Generate one with:  python -c \"import secrets; print(secrets.token_urlsafe(64))\"  "
        "and set it in your .env file or hosting dashboard."
    )

def create_session(user_id, email: str, role: str = "student") -> str:
    """Create a signed JWT — survives server restarts, no DB lookup needed."""
    import jwt as pyjwt
    expires = datetime.now() + timedelta(hours=168)  # 7 days
    payload = {
        "user_id": user_id,
        "email":   email,
        "role":    role,
        "exp":     expires.timestamp(),
    }
    token = pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")
    # Also cache in memory for speed
    token_store[token] = {"user_id": user_id, "email": email, "role": role, "expires_at": expires}
    # Also save to Supabase for audit/revocation (non-fatal)
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

    # 1. In-memory cache (fastest path)
    session = token_store.get(token)
    if session:
        if datetime.now() > session["expires_at"]:
            del token_store[token]
            raise HTTPException(status_code=401, detail="Session expired")
        return session

    # 2. Decode JWT — works after restarts, no Supabase needed
    try:
        import jwt as pyjwt
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        session = {
            "user_id":    payload.get("user_id"),
            "email":      payload.get("email"),
            "role":       payload.get("role", "student"),
            "expires_at": datetime.fromtimestamp(payload["exp"]),
        }
        token_store[token] = session  # cache for next request
        return session
    except Exception:
        pass

    raise HTTPException(status_code=401, detail="Session expired — please log in again")

def require_admin(session = Depends(get_current_user)):
    if session.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return session

def require_staff(session = Depends(get_current_user)):
    if session.get("role") not in ("staff", "admin"):
        raise HTTPException(status_code=403, detail="Staff access required")
    return session

def optional_user(authorization: str = Header(None)):
    """Session if a valid token was sent, else None (for endpoints open to anonymous users)."""
    if not authorization:
        return None
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None

def require_self_or_admin(session: dict, email: str):
    """Students may only access their own records; admins may access anyone's."""
    if session.get("role") == "admin":
        return
    if (email or "").strip().lower() != (session.get("email") or "").strip().lower():
        raise HTTPException(status_code=403, detail="You can only access your own data")


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
    question:      str
    answer:        str
    rating:        str   # "up" or "down"
    office:        Optional[str] = None

class EscalationCreate(BaseModel):
    student_name:  str
    subject:       str
    message:       str

class EscalationReply(BaseModel):
    admin_reply: str

class AnnouncementRead(BaseModel):
    action: str = "read"   # "read" or "dismissed"

class StaffMessageCreate(BaseModel):
    to_target: str
    type:      str = "info"
    text:      str

class SurveyResponse(BaseModel):
    student_name:          Optional[str] = None
    student_nationality:   Optional[str] = None
    student_major:         Optional[str] = None
    student_year:          Optional[str] = None
    arrival_confusion:     Optional[str] = None
    info_source:           Optional[str] = None
    hardest_topic:         Optional[str] = None
    info_quality:          Optional[int] = None
    uniadvisor_usefulness: Optional[int] = None
    missing_feature:       Optional[str] = None
    open_feedback:         Optional[str] = None

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
            token = create_session(user["id"], user["email"], role=user.get("role","student"))
            return {
                "token": token,
                "user":  {k: v for k, v in user.items() if k != "password_hash"},
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # No Supabase → no user store to check against. Refuse rather than fall back
    # to hardcoded credentials.
    raise HTTPException(status_code=503, detail="Login unavailable: user database not connected")

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
async def chat(req: ChatRequest, session = Depends(get_current_user)):
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
# TEXT EXTRACTION HELPER
# ═══════════════════════════════════════════════════════════════

def _extract_text(contents: bytes, filename: str) -> str:
    """Extract plain text from PDF, DOCX, or TXT bytes."""
    fn = filename.lower()
    try:
        if fn.endswith(".pdf"):
            import io
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(contents))
            return "\n".join(p.extract_text() or "" for p in reader.pages)
        elif fn.endswith(".docx"):
            import io
            from docx import Document as DocxDocument
            doc = DocxDocument(io.BytesIO(contents))
            return "\n".join(p.text for p in doc.paragraphs)
        else:
            return contents.decode("utf-8", errors="ignore")
    except Exception as e:
        raise ValueError(f"Cannot extract text from {filename}: {e}")


# ═══════════════════════════════════════════════════════════════
# DOCUMENTS
# ═══════════════════════════════════════════════════════════════

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), office: str = "general", session = Depends(require_admin)):
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
def create_announcement(item: AnnouncementCreate, session = Depends(require_staff)):
    ann = {
        "text":         item.text,
        "type":         item.type,
        "active":       True,
        "scheduled_at": item.scheduled_at or datetime.now().isoformat(),
        "expires_at":   item.expires_at,
        "created_by":   session["email"],
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
def delete_announcement(ann_id: int, session = Depends(require_staff)):
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


@app.post("/announcements/{ann_id}/read")
def mark_announcement(ann_id: int, item: AnnouncementRead, session = Depends(get_current_user)):
    if item.action not in ("read", "dismissed"):
        raise HTTPException(status_code=400, detail="action must be 'read' or 'dismissed'")
    if SUPABASE_AVAILABLE:
        try:
            sb.table("announcement_reads").upsert({
                "announcement_id": ann_id,
                "student_email":   session["email"],
                "action":          item.action,
            }, on_conflict="announcement_id,student_email").execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Recorded."}

@app.get("/announcements/receipts")
def announcement_receipts(session = Depends(require_staff)):
    """Read/dismissed counts per announcement, for the staff portal."""
    if not SUPABASE_AVAILABLE:
        return {"receipts": {}}
    try:
        rows = sb.table("announcement_reads").select("announcement_id, action").execute().data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    counts = {}
    for r in rows:
        c = counts.setdefault(r["announcement_id"], {"read": 0, "dismissed": 0})
        if r["action"] in c:
            c[r["action"]] += 1
    return {"receipts": counts}


# ═══════════════════════════════════════════════════════════════
# STAFF PORTAL DATA
# ═══════════════════════════════════════════════════════════════

@app.get("/staff/activity")
def staff_activity(session = Depends(require_staff)):
    if not SUPABASE_AVAILABLE:
        return {"activity": []}
    try:
        result = sb.table("chat_logs").select("student_name, major, question, asked_at") \
                   .order("asked_at", desc=True).limit(50).execute()
        return {"activity": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/staff/students")
def staff_students(session = Depends(require_staff)):
    if not SUPABASE_AVAILABLE:
        return {"students": []}
    try:
        result = sb.table("users").select("full_name, email, major, year_of_study, student_id, active") \
                   .eq("role", "student").order("full_name").execute()
        return {"students": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/staff/messages")
def staff_messages(session = Depends(require_staff)):
    if not SUPABASE_AVAILABLE:
        return {"messages": []}
    try:
        result = sb.table("staff_messages").select("*").eq("from_email", session["email"]) \
                   .order("sent_at", desc=True).execute()
        return {"messages": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/staff/messages")
def send_staff_message(item: StaffMessageCreate, session = Depends(require_staff)):
    if not SUPABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Supabase not connected")
    target = item.to_target.strip()
    try:
        found = sb.table("users").select("full_name").eq("email", session["email"]).execute().data
        from_name = (found[0].get("full_name") if found else None) or session["email"]
        result = sb.table("staff_messages").insert({
            "from_email": session["email"],
            "from_name":  from_name,
            "to_target":  target,
            "type":       item.type,
            "text":       item.text.strip(),
            "is_group":   "all" in target.lower() or "year" in target.lower() or "@" not in target,
        }).execute()
        return {"message": "Message sent.", "data": result.data[0] if result.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# SURVEY
# ═══════════════════════════════════════════════════════════════

@app.post("/survey")
def submit_survey(item: SurveyResponse, session = Depends(optional_user)):
    """Open to anonymous users (public /survey page); the email comes only from a valid token."""
    if not SUPABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Supabase not connected")
    entry = item.model_dump() if hasattr(item, "model_dump") else item.dict()
    entry["student_email"] = session["email"] if session else "anonymous"
    entry["student_name"]  = (item.student_name or "Anonymous") if session else "Anonymous"
    entry["submitted_at"]  = datetime.now().isoformat()
    try:
        sb.table("survey_responses").insert(entry).execute()
        return {"message": "Thank you!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/survey-responses")
def survey_responses(session = Depends(require_admin)):
    if not SUPABASE_AVAILABLE:
        return {"responses": []}
    try:
        result = sb.table("survey_responses").select("*").order("submitted_at", desc=True).execute()
        return {"responses": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# FEEDBACK (thumbs up/down)
# ═══════════════════════════════════════════════════════════════

@app.post("/feedback")
def submit_feedback(item: FeedbackItem, session = Depends(get_current_user)):
    entry = {
        "student_email": session["email"],
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
def get_feedback(session = Depends(require_admin)):
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

@app.get("/debug/indexed-documents")
def debug_indexed_documents(session = Depends(require_admin)):
    """Show what documents are currently indexed in memory (for debugging)."""
    from rag import _doc_chunks, _doc_lock, OFFICES
    with _doc_lock:
        chunks = list(_doc_chunks)
    
    # Group by source
    by_source = {}
    for chunk in chunks:
        src = chunk["source"]
        if src not in by_source:
            by_source[src] = {"count": 0, "office": chunk["office"], "sample": ""}
        by_source[src]["count"] += 1
        if not by_source[src]["sample"]:
            by_source[src]["sample"] = chunk["text"][:100] + "..."
    
    return {
        "total_chunks": len(chunks),
        "documents": by_source,
        "available_offices": {k: v["name"] for k, v in OFFICES.items()},
    }

@app.get("/debug/search")
def debug_search(q: str, office: str = "auto", session = Depends(require_admin)):
    """Test BM25 search directly (for debugging)."""
    from rag import _bm25_search, detect_office
    
    if office == "auto":
        office = detect_office(q)
    
    results = _bm25_search(q, office=office, k=3)
    if not results and office != "general":
        results = _bm25_search(q, office=None, k=3)
    
    return {
        "query": q,
        "detected_office": office,
        "results_found": len(results),
        "results": [
            {
                "source": r["source"],
                "office": r["office"],
                "preview": r["text"][:150] + "..."
            }
            for r in results
        ]
    }


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
def get_escalations(status: Optional[str] = None, session = Depends(require_admin)):
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
def create_escalation(item: EscalationCreate, session = Depends(get_current_user)):
    entry = {
        "student_email": session["email"],
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
def reply_escalation(esc_id: int, reply: EscalationReply, session = Depends(require_admin)):
    if not SUPABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Supabase not connected")
    try:
        result = sb.table("escalations").update({
            "admin_reply": reply.admin_reply,
            "replied_by":  session["email"],
            "replied_at":  datetime.now().isoformat(),
            "status":      "replied",
        }).eq("id", esc_id).execute()
        audit(session["email"], session["role"], "REPLY_ESCALATION", f"escalation:{esc_id}")
        return {"message": "Reply sent.", "escalation": result.data[0] if result.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/escalations/student/{email}")
def student_escalations(email: str, session = Depends(get_current_user)):
    """Called by student chat to show their own escalation replies."""
    require_self_or_admin(session, email)
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
def get_progress(student_email: str, session = Depends(get_current_user)):
    require_self_or_admin(session, student_email)
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
def update_progress(item: ProgressTaskUpdate, session = Depends(get_current_user)):
    require_self_or_admin(session, item.student_email)
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
def create_event(item: EventCreate, session = Depends(require_admin)):
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
def delete_event(event_id: int, session = Depends(require_admin)):
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
def get_audit_log(limit: int = 50, session = Depends(require_admin)):
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
        from groq_key_rotator import get_groq_rotator, final_text
        contents = await file.read()
        text = _extract_text(contents, file.filename)
        if len(text) > 8000:
            text = text[:8000] + "\n\n[Truncated...]"
        lang_name = "Hungarian" if target_language == "hu" else "English"
        rotator  = get_groq_rotator()
        response = rotator.chat(
            messages=[{"role":"user","content":f"Translate to {lang_name}. Preserve structure. Only output translated text.\n\n{text}"}],
            max_tokens=8192, temperature=0.1,
        )
        translated   = final_text(response)
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
@app.get("/landing")
async def landing_page():
    """Public landing page — no auth required."""
    import os as _os
    # Check project root first, then dist folder
    for path in ["landing.html", "dist/landing.html"]:
        if _os.path.isfile(path):
            return FileResponse(path, media_type="text/html")
    # Fallback: serve the React app (landing.html will be bundled in dist)
    index = _os.path.join(_os.path.dirname(__file__), "dist", "index.html")
    if _os.path.isfile(index):
        return FileResponse(index, media_type="text/html")
    return {"error": "Landing page not found"}


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