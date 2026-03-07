# 🎓 UniAdvisor AI
### AI-Powered Student Advising Platform — Dunaújváros Egyetem
**Built by John Jerry Gordon Mensah**

---

## 🗂️ Project Structure

```
uniadvisor/
├── backend/
│   ├── main.py          ← FastAPI app (API endpoints)
│   ├── rag.py           ← RAG pipeline (LangChain + Groq + ChromaDB)
│   ├── ingest.py        ← Document ingestion (PDF, TXT, DOCX)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx      ← Full chatbot UI + Admin panel
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
├── render.yaml          ← One-click Render deployment
├── .gitignore
└── README.md
```

---

## ⚡ Quick Start (Local)

### 1. Get your Groq API Key
- Go to https://console.groq.com
- Sign up for free
- Create an API key
- Copy it

### 2. Run the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
# Open .env and paste your Groq API key

# Start the server
python main.py
```

Backend will be running at: **http://localhost:8000**
API docs at: **http://localhost:8000/docs**

### 3. Run the Frontend

```bash
# Open a new terminal
cd frontend

# Install dependencies
npm install

# Create your .env file
cp .env.example .env
# The default VITE_API_URL=http://localhost:8000 is fine for local dev

# Start the dev server
npm run dev
```

Frontend will be running at: **http://localhost:3000**

---

## 📤 Uploading University Documents

Once the app is running:

1. Click **"Admin Panel"** in the sidebar
2. Click the upload area and select a **PDF, TXT, or DOCX** file
3. Wait for "✅ Ingested successfully" confirmation
4. The AI will now answer questions based on that document!

**Start with:**
- Course catalog (PDF)
- Academic handbook (PDF)
- Scholarship information (PDF or TXT)
- University policies (PDF)

---

## 🚀 Deploy to Render (Free)

### Step 1 — Push to GitHub
```bash
# In the root uniadvisor/ folder:
git init
git add .
git commit -m "Initial commit - UniAdvisor AI"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/uniadvisor.git
git push -u origin main
```

### Step 2 — Connect to Render
1. Go to https://render.com and sign up
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repo
4. Render will detect `render.yaml` automatically
5. Set your environment variable:
   - Key: `GROQ_API_KEY`
   - Value: your Groq API key
6. Click **Deploy**

### Step 3 — Update Frontend URL
After deployment, Render gives you a backend URL like:
`https://uniadvisor-backend.onrender.com`

Update `render.yaml` → `VITE_API_URL` with that exact URL, then redeploy.

---

## 🛠️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| AI/LLM     | Groq API (LLaMA3-8B)               |
| RAG        | LangChain + ChromaDB                |
| Embeddings | HuggingFace all-MiniLM-L6-v2       |
| Backend    | FastAPI + Python                    |
| Frontend   | React + Vite                        |
| Deployment | Render (free tier)                  |

---

## 📡 API Endpoints

| Method | Endpoint      | Description                     |
|--------|---------------|---------------------------------|
| GET    | /             | Health check                    |
| POST   | /chat         | Send a message, get AI response |
| POST   | /upload       | Upload a university document    |
| GET    | /documents    | List all indexed documents      |
| GET    | /stats        | Usage statistics                |
| GET    | /docs         | Interactive API documentation   |

---

## 🔑 Environment Variables

**Backend (.env)**
```
GROQ_API_KEY=your_key_here
```

**Frontend (.env)**
```
VITE_API_URL=http://localhost:8000  # local
# or
VITE_API_URL=https://your-backend.onrender.com  # production
```

---

*Built with ❤️ for Dunaújváros Egyetem by John Jerry Gordon Mensah*