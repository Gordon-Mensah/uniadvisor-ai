# 🎓 UniAdvisor AI
### AI-Powered Student Advising Platform — Dunaújváros Egyetem
**Built by John Jerry Gordon Mensah**

---

## � Table of Contents

- [🎯 Project Overview](#-project-overview)
- [🏗️ Architecture & Tech Stack](#️-architecture--tech-stack)
- [⚡ Quick Start Guide](#-quick-start-guide)
- [🤖 AI System Details](#-ai-system-details)
- [👥 User Roles & Features](#-user-roles--features)
- [📄 Document Management](#-document-management)
- [🗄️ Database Schema](#️-database-schema)
- [🚀 Deployment Guide](#-deployment-guide)
- [🛠️ Development Setup](#️-development-setup)
- [📊 Analytics & Monitoring](#-analytics--monitoring)
- [🔧 API Reference](#-api-reference)
- [🧪 Testing & Quality Assurance](#-testing--quality-assurance)
- [🔒 Security Features](#-security-features)
- [📈 Performance Optimization](#-performance-optimization)
- [🔮 Future Enhancements](#-future-enhancements)
- [📚 Research & Methodology](#-research--methodology)
- [🕷️ Data Collection Ethics](#️-data-collection-ethics)
- [🙏 Acknowledgments](#-acknowledgments)

---

## 🎯 Project Overview

**UniAdvisor AI** is a comprehensive AI-powered student advising platform specifically designed for Dunaújváros Egyetem (University of Dunaújváros). The system provides 24/7 intelligent responses to student inquiries by leveraging university documents through advanced Retrieval-Augmented Generation (RAG) technology.

### Key Capabilities

- **Intelligent Q&A**: Answers questions about courses, admissions, policies, and campus services
- **Multi-language Support**: Handles English and Hungarian questions; answers in the language chosen with the in-app toggle
- **Document-Driven Responses**: All answers grounded in official university materials
- **Office Routing**: Automatically directs questions to relevant university departments
- **Multi-Role Access**: Separate interfaces for students, staff, and administrators
- **Usage Analytics**: Question counts by office, answer ratings, escalations and survey results in the admin portal

### Target Users

- **Students**: International and domestic students seeking academic guidance
- **Staff**: University employees managing student services and communications
- **Administrators**: System managers overseeing platform performance and content

---

## 🏗️ Architecture & Tech Stack

### Backend Architecture

| Component | Technology | Purpose |
|-----------|------------|---------|
| **API Framework** | FastAPI (Python 3.11.9) | RESTful API with automatic OpenAPI docs |
| **Authentication** | JWT + bcrypt | Secure session management |
| **Database** | Supabase (PostgreSQL) | Persistent data storage with real-time capabilities |
| **AI Engine** | gpt-oss-20b (via Groq) | Large language model for response generation (`GROQ_MODEL`) |
| **Search Algorithm** | Custom BM25 | Document retrieval without embeddings |
| **Document Processing** | pypdf, python-docx | Text extraction from university materials |

### Frontend Architecture

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Framework** | React 18 + Vite 5 | Modern web application with fast development |
| **State Management** | React Hooks | Component-level state management |
| **Styling** | Inline CSS + Themes | Responsive design with dark/light modes |
| **Real-time** | Supabase JS | Live data synchronization |

### AI Pipeline

```
Student Query → Office Detection → BM25 Search → Context Retrieval → LLM Generation → Sourced Response
```

### Deployment Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Hosting** | Render | Free tier web service hosting, defined in `render.yaml` |
| **Deployment** | Render auto-deploy | Render builds (`build.sh`) and deploys automatically from the `main` branch; there is no separate CI pipeline |
| **Environment** | Render native Python runtime | Python 3.11.9, started with `uvicorn main:app` |
| **Monitoring** | Render logs + admin dashboard | Server logs on Render; question counts and ratings in the admin portal |

---

## ⚡ Quick Start Guide

### Prerequisites

- Python 3.11.9
- Node.js 18+
- Git
- Supabase account (free tier)
- Groq API key (free tier available)

### 1. Clone and Setup

```bash
git clone https://github.com/Gordon-Mensah/uniadvisor-ai.git
cd uniadvisor-ai
```

### 2. Backend Setup

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment: create a .env file with the backend variables
# listed under "Environment Variables" below (there is no .env.example)
```

### 3. Frontend Setup

```bash
# Install Node dependencies
npm install

# Configure environment: create a .env file with the frontend variables
# listed under "Environment Variables" below
```

### 4. Database Setup

Create these tables in your Supabase database:

```sql
-- Users and authentication
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'student', -- 'student', 'staff', 'admin'
  major TEXT,
  year_of_study TEXT,
  nationality TEXT,
  language_pref TEXT DEFAULT 'en',
  active BOOLEAN DEFAULT true,
  onboarding_done BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Document storage
CREATE TABLE document_chunks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  text TEXT NOT NULL,
  source TEXT NOT NULL,
  office TEXT DEFAULT 'general',
  page INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chat and analytics
CREATE TABLE chat_logs (
  id SERIAL PRIMARY KEY,
  question TEXT,
  answer TEXT,
  student_name TEXT,      -- no longer written (anonymous logs); kept for old rows
  major TEXT,
  year_of_study TEXT,
  nationality TEXT,       -- no longer written (anonymous logs); kept for old rows
  office_routed TEXT,
  session_id TEXT,
  asked_at TIMESTAMP DEFAULT NOW()
);

-- Additional tables for full functionality
CREATE TABLE announcements (id SERIAL PRIMARY KEY, text TEXT, type TEXT, active BOOLEAN DEFAULT true, scheduled_at TIMESTAMP, expires_at TIMESTAMP);
CREATE TABLE audit_log (id SERIAL PRIMARY KEY, actor_email TEXT, actor_role TEXT, action TEXT, target TEXT, detail JSONB, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE auth_tokens (id SERIAL PRIMARY KEY, user_id INT, token TEXT, expires_at TIMESTAMP);
CREATE TABLE escalations (id SERIAL PRIMARY KEY, student_email TEXT, student_name TEXT, subject TEXT, message TEXT, status TEXT DEFAULT 'open', admin_reply TEXT, replied_by TEXT, replied_at TIMESTAMP);
CREATE TABLE events (id SERIAL PRIMARY KEY, title TEXT, description TEXT, location TEXT, starts_at TIMESTAMP, ends_at TIMESTAMP, category TEXT, created_by TEXT);
CREATE TABLE feedback (id SERIAL PRIMARY KEY, student_email TEXT, question TEXT, answer TEXT, rating TEXT, office TEXT);
CREATE TABLE progress (id SERIAL PRIMARY KEY, student_email TEXT, task_key TEXT, label TEXT, done BOOLEAN DEFAULT false, done_at TIMESTAMP);
CREATE TABLE survey_responses (id SERIAL PRIMARY KEY, responses JSONB, submitted_at TIMESTAMP DEFAULT NOW());
```

### 5. Run the Application

```bash
# Both at once (backend on :8000, frontend on :3000)
python start.py
```

or separately:

```bash
# Terminal 1: Backend
uvicorn main:app --reload --port 8000
```

```bash
# Terminal 2: Frontend
npm run dev
```

Visit `http://localhost:3000` for the application and `http://localhost:8000/docs` for API documentation.

---

## 🤖 AI System Details

### Retrieval-Augmented Generation (RAG) Pipeline

The system uses a custom RAG implementation optimized for university advising:

#### 1. Document Ingestion
- **Input Formats**: PDF, DOCX, TXT files
- **Text Extraction**: Automatic parsing using specialized libraries
- **Chunking Strategy**: 400-word chunks with 80-word overlap
- **Metadata Tagging**: Office classification and page numbers

#### 2. Office Detection System
Questions are automatically routed to 10 university departments:

| Office | Emoji | Keywords | Purpose |
|--------|-------|----------|---------|
| Study Office | 📚 | course, grade, exam, credit, registration | Academic administration |
| International Relations | 🌍 | erasmus, visa, residence, scholarship | International student services |
| Finance & Fees | 💰 | fee, tuition, payment, invoice, refund | Financial matters |
| IT Helpdesk | 💻 | wifi, password, computer, system, login | Technical support |
| Library | 📖 | book, journal, borrow, database | Academic resources |
| Student Union | 🎓 | club, event, sport, dormitory, housing | Student life |
| Computer Science Dept | 🖥️ | programming, software, algorithm | CS-specific guidance |
| Engineering Dept | ⚙️ | mechanical, electrical, manufacturing | Engineering support |
| Economics & Business | 📈 | business, management, marketing | Business education |
| General | 🏛️ | university-wide policies | General inquiries |

#### 3. BM25 Search Algorithm
- **No Embeddings Required**: Uses term frequency analysis
- **Hungarian Support**: Handles accented characters and local terminology
- **Office Filtering**: Searches within relevant department documents first
- **Fallback Strategy**: Expands to general documents if no matches found

#### 4. Language Management
- **Input**: Accepts questions in English or Hungarian
- **Response Locking**: Answers in the language selected with the in-app toggle (`reply_lang`), whatever language the question is in
- **Search Translation**: With `RETRIEVAL_MODE=translate` (production), Hungarian questions are translated to English for the search only; the answer stays in the selected language

#### 5. LLM Integration
- **Model**: gpt-oss-20b via Groq API (`GROQ_MODEL`, default `openai/gpt-oss-20b`), `reasoning_effort=low`
- **Fallback Models**: none by default; optional list in `GROQ_FALLBACK_MODELS`, tried when a key is rate-limited
- **Key Rotation**: several Groq keys (`GROQ_API_KEY_1`, `_2`, ...) are rotated on rate limits
- **Context**: the top 3 retrieved chunks and the last 4 chat messages
- **Temperature**: 0.1 for consistent, factual responses

### Response Generation Process

1. **Query Analysis**: Extract keywords (and, in `translate` mode, translate Hungarian questions for the search)
2. **Office Routing**: Classify question by department
3. **Document Retrieval**: Find top 3 most relevant chunks
4. **Context Assembly**: Combine chunks into coherent context
5. **Prompt Engineering**: Create system prompt with university context
6. **LLM Generation**: Generate response using retrieved context
7. **Source Attribution**: Include document references in response

---

## 👥 User Roles & Features

### Student Portal

#### Core Features
- **AI Chat Interface**: Natural language Q&A with university knowledge
- **Progress Tracking**: Visual task completion with progress bars
- **Campus Map**: Interactive office locator with contact information
- **Event Calendar**: Upcoming university events and announcements
- **Escalation System**: Direct contact with human advisors for complex issues
- **Feedback System**: Rate AI responses for continuous improvement

#### Onboarding Experience
- **6-Step Guided Tour**: Introduction to platform features
- **Personalization**: Profile setup with major, year, and nationality
- **Language Selection**: English/Hungarian interface toggle
- **Quick Start**: Pre-written common questions

### Staff Portal

#### Administrative Tools
- **Announcement Management**: Create/edit/delete university-wide announcements
- **Escalation Inbox**: Handle student questions AI cannot answer
- **Basic Analytics**: User activity and question volume tracking
- **Student Support**: Direct communication with students

#### Communication Features
- **Announcements**: Plain-text messages, optionally scheduled
- **Priority Levels**: Info, warning, urgent
- **Staff Messages**: To one student (by email) or to a group

### Admin Portal

#### System Management
- **Document Upload**: Upload, replace and delete university documents (PDF, DOCX, TXT)
- **Office Analytics**: Questions per office
- **Satisfaction**: Thumbs-up/down ratings of answers
- **FAQ**: Most-asked question topics, grouped automatically from the questions asked
- **Event Management**: Schedule and manage campus events
- **Survey Results**: Responses to the international student survey
- **Audit Log**: Document uploads/deletes and escalation replies

#### Dashboard
- **Total Questions**, **Indexed Chunks**, **Cached Answers** and **Satisfaction** tiles
- **Office Analytics**: Question distribution by department

---

## 📄 Document Management

### Upload System

#### Supported Formats
- **PDF Files**: Academic catalogs, policy documents, handbooks
- **DOCX Files**: Word documents with complex formatting
- **TXT Files**: Plain text documents and simple lists

#### Processing Pipeline
1. **File Validation**: Accept only .pdf, .docx and .txt files
2. **Text Extraction**: Convert to plain text using specialized parsers
3. **Content Chunking**: Split into 400-word segments with overlap
4. **Office Classification**: Tag chunks by relevant department
5. **Database Storage**: Persist chunks in Supabase for retrieval
6. **Index Update**: Refresh BM25 search index

### Document Organization

#### Office-Based Categorization
Documents are automatically tagged by university department for targeted retrieval:

```python
OFFICES = {
    "study_office": ["course", "subject", "curriculum", "grade", "exam"],
    "iro": ["international", "erasmus", "exchange", "visa", "residence"],
    "finance": ["fee", "tuition", "payment", "invoice", "scholarship"],
    # ... additional offices
}
```

#### Knowledge Base Sources
- **University Website**: `university_knowledge.txt`, crawled from the public English pages of uniduna.hu (195 pages and 60 linked PDFs; see Data Collection Ethics)
- **Contact Information**: `university_contacts.txt`, office contacts
- **Uploaded Documents**: PDF, DOCX and TXT files uploaded by admins

---

## 🗄️ Database Schema

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'student', -- 'student', 'staff', 'admin'
  major TEXT,
  year_of_study TEXT,
  nationality TEXT,
  language_pref TEXT DEFAULT 'en',
  active BOOLEAN DEFAULT true,
  onboarding_done BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Document Chunks Table
```sql
CREATE TABLE document_chunks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  text TEXT NOT NULL,
  source TEXT NOT NULL,
  office TEXT DEFAULT 'general',
  page INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_source ON document_chunks(source);
CREATE INDEX idx_office ON document_chunks(office);
```

#### Chat Logs Table
```sql
CREATE TABLE chat_logs (
  id SERIAL PRIMARY KEY,
  question TEXT,
  answer TEXT,
  student_name TEXT,      -- no longer written (anonymous logs); kept for old rows
  major TEXT,
  year_of_study TEXT,
  nationality TEXT,       -- no longer written (anonymous logs); kept for old rows
  office_routed TEXT,
  session_id TEXT,
  asked_at TIMESTAMP DEFAULT NOW()
);
```

### Additional Tables

- **announcements**: University-wide communications
- **audit_log**: Security and compliance tracking
- **auth_tokens**: JWT token management
- **escalations**: Student-to-staff communication
- **events**: Campus event scheduling
- **feedback**: AI response quality ratings
- **progress**: Student task completion tracking
- **survey_responses**: Student feedback collection

---

## 🚀 Deployment Guide

### Render Deployment (Recommended)

#### 1. Repository Setup
```bash
# Push to GitHub
git add .
git commit -m "Production deployment"
git push origin main
```

#### 2. Render Configuration
1. Create account at render.com
2. Connect GitHub repository
3. Select "Blueprint" deployment
4. Configure environment variables (the secrets are `sync: false` in `render.yaml`, so enter them in the dashboard):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GROQ_API_KEY_1`
   - `JWT_SECRET`
   - `GROQ_MODEL` (optional, defaults to `openai/gpt-oss-20b`)
   - `RETRIEVAL_MODE` is set to `translate` by `render.yaml` itself

#### 3. Database Setup
- Create Supabase project
- Run SQL schema from database section
- Configure Row Level Security (RLS) policies

#### 4. Domain Configuration
- Custom domain (optional)
- SSL certificate (automatic)
- CDN integration

### Environment Variables

#### Backend (.env)
```bash
# Database (service-role key: the backend bypasses row-level security; never put it in the frontend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI
GROQ_API_KEY_1=your-groq-key
GROQ_API_KEY_2=backup-key-optional
GROQ_MODEL=openai/gpt-oss-20b          # optional; this is the default

# Retrieval and answer prompt
RETRIEVAL_MODE=translate               # production setting (render.yaml). Code default: baseline
PROMPT_MODE=default                    # default | strict (strict = abstention experiment)

# Security (required; the server refuses to start without it)
JWT_SECRET=your-256-bit-secret-key     # python -c "import secrets; print(secrets.token_urlsafe(64))"

# Optional
DOCS_DIR=./uploaded_docs
```

`RETRIEVAL_MODE` selects the retrieval used to find context for an answer:

| Value | What it does |
|---|---|
| `baseline` | BM25 over all words (code default, kept so the evaluation baseline is reproducible) |
| `stopwords` | BM25 with English and Hungarian stopwords removed |
| `translate` | `stopwords`, plus Hungarian questions are translated to English by the LLM before searching; the answer stays in the user's language. **Production setting**: highest answer accuracy in the evaluation (77.1% vs 54.2% for `baseline` on gpt-oss-20b). It costs one extra LLM call per Hungarian question. |

#### Frontend (.env)
```bash
VITE_API_URL=https://your-backend.onrender.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🛠️ Development Setup

### Local Development Environment

#### Backend Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# API documentation
# http://localhost:8000/docs
```

#### Frontend Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Checking Changes

There is no unit-test suite. Changes are checked with the frontend build and the evaluation scripts in `evaluation/` (see [Evaluation](#evaluation)).

#### Frontend
```bash
npm run build
```

#### Evaluation (from the repository root)
```bash
# Check questions.json against the knowledge base (no API calls)
python evaluation/evaluate.py --validate
```

```bash
# Retrieval metrics for the three retrieval variants (no API calls)
python evaluation/run_all.py --retrieval-only
```

```bash
# Full run: 3 retrieval variants on gpt-oss-20b, then the best one on gpt-oss-120b (needs Groq keys)
python evaluation/run_all.py
```

```bash
# Prompt experiment: default vs strict prompt (needs Groq keys)
python evaluation/run_all.py --prompt-experiment
```

```bash
# Single configuration
python evaluation/evaluate.py --retrieval translate --prompt default --model openai/gpt-oss-20b
```

```bash
# Manual check: review sheet, then agreement with the automatic scores
python evaluation/make_review_sheet.py evaluation/results/results_<run>.csv --blind
```

```bash
python evaluation/agreement.py evaluation/results/results_<run>.csv
```

Results are written to `evaluation/results/`.

---

## 📊 Analytics & Monitoring

### Usage Statistics (`GET /stats`)

Kept in memory since the last server restart:
- **Total Questions** and the most recent questions
- **Questions by Office**, **Major** and **Year**
- **Indexed Chunks** and **Cached Answers**

### Other Admin Views
- **Office Analytics** (`GET /office-analytics`): questions per office
- **Satisfaction** (`GET /feedback`): answer ratings
- **Escalations**: questions passed to human staff

### Audit Log
- **Recorded Actions**: Document upload, document delete and escalation replies (who, what, when)

---

## 🔧 API Reference

### Authentication Endpoints

#### POST /auth/login
```json
{
  "email": "student@uniduna.hu",
  "password": "password123"
}
```

#### POST /auth/logout
Requires Bearer token in Authorization header

### Chat Endpoints

#### POST /chat
```json
{
  "message": "How do I register for courses?",
  "student_name": "John Doe",
  "student_year": "Year 1",
  "student_major": "Computer Science",
  "student_nationality": "Hungarian",
  "office": "auto",
  "history": [],
  "session_id": "optional-session-id",
  "reply_lang": "en"
}
```

Response:
```json
{
  "answer": "To register for courses...",
  "sources": [
    {
      "file": "course_catalog.pdf",
      "office": "study_office",
      "office_name": "Study Office",
      "office_emoji": "📚"
    }
  ],
  "office": "study_office",
  "office_name": "Study Office",
  "office_emoji": "📚"
}
```

### Document Management

#### POST /upload
Upload university documents (PDF/DOCX/TXT)

#### GET /documents
List all indexed documents

#### GET /stats
System usage statistics

### Administrative Endpoints

#### GET /announcements
List active announcements

#### POST /announcements
Create new announcement

#### GET /escalations
List student escalations

#### POST /events
Create campus events

---

## 🧪 Testing & Quality Assurance

### Demo System

#### Interactive Showcase
- **Demo.jsx**: Live demonstration page
- **Sample Conversations**: Pre-recorded Q&A examples
- **Pipeline Visualization**: Step-by-step AI processing
- **Technology Breakdown**: Complete stack explanation

### Evaluation

The evaluation lives in `evaluation/`. It runs questions through the same `rag.get_answer()`
the app uses (`rag.py` and `main.py` are not modified for it).

#### Test set (`evaluation/questions.json`)
- **60 questions**: 42 in English, 18 in Hungarian
- **48 answerable** (each with an expected answer, required key facts and the source passage on the
  university website) and **12 unanswerable** (the system should say it does not know)
- Categories: fees, visa, campus, health, offices, Neptun, housing, deadlines, admission, Moodle

#### Metrics (`evaluation/evaluate.py`)
- **Retrieval**: Hit@k and MRR, i.e. whether the chunk holding the gold source passage was retrieved
- **Answer correctness**: the answer contains every required key fact
- **Abstention**: unanswerable questions correctly declined; answerable questions wrongly refused
- **Response time** of `get_answer()` (retrieval + LLM call)

#### Configurations compared (`evaluation/run_all.py`)
- **3 retrieval variants** (`RETRIEVAL_MODE`): `baseline`, `stopwords`, `translate`
- **2 models** via Groq: `openai/gpt-oss-20b` for all three variants, then `openai/gpt-oss-120b`
  on the best variant
- **2 prompt modes** (`PROMPT_MODE`): `default` and `strict`, compared with `translate` retrieval
  on gpt-oss-20b (`run_all.py --prompt-experiment`)
- A retrieval-only run (`--retrieval-only`) compares the three variants without any API calls

On gpt-oss-20b, `translate` gave the highest answer accuracy (77.1% vs 54.2% for `baseline`) and is
the production setting.

#### Manual check
- `evaluation/make_review_sheet.py` turns a results CSV into an HTML page for judging each answer
  by hand (`--blind` hides the automatic scores)
- `evaluation/agreement.py` compares the manual judgements with the automatic scores
  (accuracy, percentage agreement, Cohen's kappa) and lists the disagreements

---

## 🔒 Security Features

### Authentication & Authorization

#### JWT Implementation
- **Token Expiration**: 7-day session validity
- **Transport**: Bearer token in the `Authorization` header; the frontend keeps it in `sessionStorage`
- **Revocation**: Logout marks the token as revoked

#### Password Security
- **bcrypt Hashing**: Industry-standard password protection
- **Cost Factor**: 12 rounds

### Data Protection

#### Privacy Measures
- **Anonymous Chat Logs**: Student name and nationality are no longer stored with chat logs
- **Audit Logging**: Document uploads/deletes and escalation replies are recorded

#### Access Control
- **Role-Based Permissions**: Student/Staff/Admin access levels
- **Session Management**: Secure logout and token invalidation

---

## 📈 Performance Optimization

### Caching Strategy

#### Answer Caching
- **Cache Key**: Question + profile, office, language, retrieval mode and prompt mode
- **Cache Size**: 200 entries in memory; the oldest entry is evicted first
- **Scope**: Only questions without chat history are cached

#### Database Optimization
- **Indexing**: Indexes on `document_chunks.source` and `document_chunks.office`
- **Batched Inserts**: Document chunks are inserted in batches

### AI Pipeline Optimization

#### BM25 Tuning
- **Chunk Size**: 400 words with 80-word overlap
- **Term Processing**: Hungarian language support
- **Scoring Algorithm**: BM25 (top 3 chunks)

#### LLM Efficiency
- **Model**: gpt-oss-20b via Groq with low reasoning effort
- **Key Rotation**: Groq keys rotated on rate limits
- **Prompt Engineering**: Concise, context-focused prompts

---

## 🔮 Future Enhancements

### Planned Features

#### Advanced AI Capabilities
- **Multi-modal Input**: Image and document upload support
- **Voice Interaction**: Speech-to-text and text-to-speech
- **Longer Conversational Memory**: Beyond the last 4 messages used today
- **Personalized Responses**: User history and preference learning

#### Platform Extensions
- **Mobile Application**: Native iOS and Android apps
- **Multi-language Support**: Additional European languages
- **Integration APIs**: Connection to university information systems
- **Advanced Analytics**: Machine learning on usage patterns

#### Administrative Features
- **Bulk Operations**: Mass user management and document uploads
- **Custom Workflows**: Configurable approval processes
- **Reporting Tools**: Advanced analytics and export capabilities
- **API Management**: Third-party integration controls

### Research Directions

#### AI Improvements
- **Fine-tuning**: University-specific model training
- **Hybrid Search**: Combining BM25 with semantic embeddings
- **Larger Evaluation**: More questions and a user study with students
- **Bias Detection**: Ensuring fair and inclusive responses

#### User Experience
- **Accessibility**: WCAG compliance and screen reader support
- **Progressive Web App**: Offline functionality and app-like experience
- **Personalization**: Adaptive interface based on user preferences
- **Gamification**: Achievement system for student engagement

---

## 📚 Research & Methodology

### Development Process

#### Research Phase
- **Problem Analysis**: Student advising challenges at Dunaújváros Egyetem
- **Literature Review**: RAG systems, university chatbots, BM25 algorithms
- **Requirements Gathering**: Survey of 23 international students (24–25 March 2026) and a review of the university website
- **Architecture Design**: System design and technology selection

#### Implementation Phase
- **Iterative Development**: Built and first deployed in March 2026, then extended
- **Checks**: Frontend build and the evaluation scripts in `evaluation/`

#### Evaluation Phase
- **Accuracy Benchmark**: 60-question test set (English and Hungarian, answerable and unanswerable)
- **Retrieval Variants**: `baseline`, `stopwords` and `translate` BM25 retrieval compared
- **Models**: gpt-oss-20b and gpt-oss-120b via Groq
- **Prompt Modes**: `default` vs `strict` answer prompt
- **Manual Check**: hand-marked answers compared with the automatic scores (Cohen's kappa)

### Technical Innovation

#### BM25 Implementation
- **Algorithm Selection**: Chosen over embedding-based search for efficiency
- **Hungarian Support**: Tokenizer keeps Hungarian accented letters; optional English/Hungarian stopword removal
- **Office Filtering**: Department-specific search optimization
- **Retrieval Variants**: baseline, stopwords and translate, compared in the evaluation

#### RAG Pipeline
- **Document Processing**: Custom chunking strategy for academic content
- **Context Assembly**: Intelligent context selection and ranking
- **Prompt Engineering**: University-specific system prompts
- **Source Attribution**: Each answer lists the documents it used

---

## 🕷️ Data Collection Ethics

**What was crawled.** The knowledge base (`university_knowledge.txt`) was collected by
`crawler.py` from the University of Dunaújváros's public English website, starting at
`https://www.uniduna.hu/en/` and following only links whose path starts with `/en`.
The result contains 195 HTML pages (200 visited, the crawler's `MAX_PAGES` limit, of which
5 failed) and the text of 60 linked PDF documents; 145 images were also downloaded to
`scraped_images/`. Only publicly accessible pages were fetched — no login, forms or
personal-data pages. `scraper.py` is an earlier version that fetches a fixed list of
about 60 `/en/` URLs with the same delays.

**When.** 4 March 2026, starting 02:16 (local time), i.e. outside office hours, as recorded
in the header of `university_knowledge.txt`.

**Request rate.** One request at a time, with a pause after each request: 0.8 s after
each page, 0.5 s after each PDF, 0.3 s after each image — roughly 405 requests in total,
at most about 1.25 requests per second for pages. Every request had a timeout (10–20 s).

**robots.txt.** The crawler did not read `https://www.uniduna.hu/robots.txt` before
crawling, and robots.txt could not be retrieved retrospectively from the development
environment used for this write-up. Check it with:

```bash
curl -s https://www.uniduna.hu/robots.txt
```

and record which `Disallow` rules apply to `User-agent: *` and whether a `Crawl-delay`
is set. If `/en/` (or a prefix of it) is disallowed, or a `Crawl-delay` above 0.8 s is set,
the crawl did not follow the site's stated policy and should be disclosed as such.

**Limitations.** The crawler sent a desktop-browser `User-Agent` string instead of
identifying itself as a research crawler with contact details, and it had no
robots.txt check or automatic back-off on errors. A future re-crawl should add
`urllib.robotparser`, an honest User-Agent (e.g. `UniAdvisorResearchBot/1.0 (+contact email)`),
at least a 1 s delay (or the site's `Crawl-delay`), and back-off on HTTP 429/5xx responses.

---

## 🙏 Acknowledgments

### University Support
- **Dunaújváros Egyetem**: Institutional support and domain expertise
- **International Relations Office**: Student data and requirements
- **IT Department**: Technical infrastructure and deployment support

### Technical Contributors
- **Supabase Team**: Database infrastructure and real-time capabilities
- **Groq Team**: High-performance LLM API and model access
- **FastAPI Community**: Robust API framework and documentation

### Research Support
- **Academic Advisors**: Guidance on research methodology
- **Student Participants**: Survey responses on information needs
- **Peer Reviewers**: Code review and quality assurance

---

## 📞 Support & Contact

### Technical Support
- **GitHub Issues**: Bug reports and feature requests
- **Documentation**: Comprehensive API and deployment guides
- **Community**: Developer discussions and contributions

### University Contact
- **Dunaújváros Egyetem**: https://www.uniduna.hu
- **International Relations Office**: international@uniduna.hu
- **IT Helpdesk**: it@uniduna.hu

---

*Built with ❤️ for Dunaújváros Egyetem by John Jerry Gordon Mensah*
*Empowering students with AI-driven academic guidance*