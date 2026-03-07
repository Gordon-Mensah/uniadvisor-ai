import os
import io
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter

CHROMA_DIR  = "./chroma_db"
EMBED_MODEL = "all-MiniLM-L6-v2"
MAX_BATCH   = 100

BLOCKED_NAMES = {
    ".env", "env", ".env.local", ".env.production",
    ".gitignore", "requirements.txt", "package.json",
    "package-lock.json", "vite.config.js", "config",
}
ALLOWED_EXT = {".pdf", ".txt", ".docx"}

# ── Offices — single source of truth ─────────────────────
OFFICES = {
    "study_office":   { "name": "Study Office",                  "emoji": "📚", "keywords": ["course","subject","curriculum","grade","exam","credit","registration","enrolment","transcript","timetable","schedule","beiratkozás","kurzus","tanulmány"] },
    "iro":            { "name": "International Relations Office", "emoji": "🌍", "keywords": ["international","erasmus","exchange","visa","residence","foreign","scholarship abroad","application","iro","international student","külföldi","ösztöndíj","csere"] },
    "finance":        { "name": "Finance & Fees Office",          "emoji": "💰", "keywords": ["fee","tuition","payment","invoice","scholarship","financial","refund","bank","díj","fizetés","ösztöndíj","pénzügy"] },
    "it_helpdesk":    { "name": "IT Helpdesk",                    "emoji": "💻", "keywords": ["it","wifi","password","computer","system","login","email","vpn","software","hardware","network","it support","számítógép","wifi","jelszó"] },
    "library":        { "name": "Library",                        "emoji": "📖", "keywords": ["library","book","journal","borrow","return","database","ebsco","opening hours","könyvtár","könyv","folyóirat"] },
    "student_union":  { "name": "Student Union",                  "emoji": "🎓", "keywords": ["student union","club","event","society","sport","dormitory","housing","accommodation","hallgatói","kollégium","szakkollégium"] },
    "cs_dept":        { "name": "Computer Science Dept.",         "emoji": "🖥️", "keywords": ["computer science","programming","software","algorithm","database","cs","informatika","programozás","szoftver"] },
    "engineering":    { "name": "Engineering Dept.",              "emoji": "⚙️", "keywords": ["engineering","mechanical","electrical","civil","manufacturing","műszaki","gépész","villamosmérnök"] },
    "economics":      { "name": "Economics & Business Dept.",     "emoji": "📈", "keywords": ["economics","business","management","finance","marketing","accounting","gazdaság","üzlet","menedzsment"] },
    "general":        { "name": "General / University-wide",      "emoji": "🏛️", "keywords": [] },
}


def _is_safe(filename: str) -> bool:
    if not filename:
        return False
    name = filename.lower().strip()
    if name in BLOCKED_NAMES or name.startswith("."):
        return False
    return os.path.splitext(name)[1] in ALLOWED_EXT


def get_embeddings():
    return HuggingFaceEmbeddings(model_name=EMBED_MODEL)


def get_vectorstore():
    return Chroma(
        persist_directory=CHROMA_DIR,
        embedding_function=get_embeddings(),
        collection_name="university_docs",
    )


def extract_text(contents: bytes, filename: str):
    ext = os.path.splitext(filename.lower())[1]
    if ext == ".txt":
        return contents.decode("utf-8", errors="ignore")
    elif ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(contents))
            pages = []
            for i, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append((text, i))
            return pages
        except Exception as e:
            raise ValueError(f"Could not read PDF: {e}")
    elif ext == ".docx":
        try:
            import docx
            doc = docx.Document(io.BytesIO(contents))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception as e:
            raise ValueError(f"Could not read DOCX: {e}")
    raise ValueError(f"Unsupported file type: {ext}")


def ingest_document(contents: bytes, filename: str, office: str = "general") -> dict:
    """Index a document tagged to a specific office."""
    if not _is_safe(filename):
        raise ValueError(f"'{filename}' is not allowed. Only PDF, TXT, DOCX files can be uploaded.")
    if office not in OFFICES:
        office = "general"

    ext = os.path.splitext(filename.lower())[1]
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800, chunk_overlap=100,
        separators=["\n\n", "\n", ".", " "],
    )

    all_texts, all_metas = [], []

    if ext == ".pdf":
        pages = extract_text(contents, filename)
        if not pages:
            raise ValueError("Document appears to be empty or unreadable.")
        for (page_text, page_idx) in pages:
            for j, chunk in enumerate(splitter.split_text(page_text)):
                all_texts.append(chunk)
                all_metas.append({
                    "source": filename,
                    "office": office,
                    "office_name": OFFICES[office]["name"],
                    "page":   page_idx,
                    "chunk":  len(all_texts) - 1,
                })
    else:
        raw = extract_text(contents, filename)
        if isinstance(raw, list):
            raw = "\n".join(t for t, _ in raw)
        if not raw.strip():
            raise ValueError("Document appears to be empty or unreadable.")
        for j, chunk in enumerate(splitter.split_text(raw)):
            all_texts.append(chunk)
            all_metas.append({
                "source":      filename,
                "office":      office,
                "office_name": OFFICES[office]["name"],
                "chunk":       j,
            })

    if not all_texts:
        raise ValueError("No text chunks could be created from this document.")

    vs = get_vectorstore()
    for i in range(0, len(all_texts), MAX_BATCH):
        vs.add_texts(texts=all_texts[i:i+MAX_BATCH], metadatas=all_metas[i:i+MAX_BATCH])
        print(f"  [{office}] Indexed {min(i+MAX_BATCH, len(all_texts))}/{len(all_texts)} chunks")
    vs.persist()
    return {"chunks": len(all_texts), "filename": filename, "office": office}


def list_documents() -> list:
    """Return documents grouped by office."""
    try:
        results = get_vectorstore()._collection.get()
        seen = {}
        for m in results.get("metadatas", []):
            if not m:
                continue
            src = m.get("source", "")
            if not src or not _is_safe(src):
                continue
            if src not in seen:
                seen[src] = {
                    "name":        src,
                    "office":      m.get("office", "general"),
                    "office_name": m.get("office_name", "General"),
                }
        return list(seen.values())
    except Exception:
        return []


def list_documents_by_office(office: str) -> list:
    """Return only documents for a specific office."""
    return [d for d in list_documents() if d["office"] == office]


def purge_bad_documents() -> list:
    try:
        vs      = get_vectorstore()
        results = vs._collection.get()
        bad_ids, bad = [], set()
        for i, m in enumerate(results.get("metadatas", [])):
            if m:
                src = m.get("source", "")
                if src and not _is_safe(src):
                    bad_ids.append(results["ids"][i])
                    bad.add(src)
        if bad_ids:
            vs._collection.delete(ids=bad_ids)
            vs.persist()
            print(f"[Purge] Removed bad docs: {bad}")
        return list(bad)
    except Exception as e:
        print(f"[Purge] Error: {e}")
        return []