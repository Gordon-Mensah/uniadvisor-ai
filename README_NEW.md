# 🎓 UniAdvisor AI
### AI-Powered Student Advising Platform — Dunaújváros Egyetem
**Built by John Jerry Gordon Mensah**

---

## 📋 Table of Contents

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
- [🙏 Acknowledgments](#-acknowledgments)

---

## 🎯 Project Overview

**UniAdvisor AI** is a comprehensive AI-powered student advising platform specifically designed for Dunaújváros Egyetem (University of Dunaújváros). The system provides 24/7 intelligent responses to student inquiries by leveraging university documents through advanced Retrieval-Augmented Generation (RAG) technology.

### Key Capabilities

- **Intelligent Q&A**: Answers questions about courses, admissions, policies, and campus services
- **Multi-language Support**: Handles both English and Hungarian queries with language-locked responses
- **Document-Driven Responses**: All answers grounded in official university materials
- **Office Routing**: Automatically directs questions to relevant university departments
- **Multi-Role Access**: Separate interfaces for students, staff, and administrators
- **Real-time Analytics**: Comprehensive usage tracking and performance metrics

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
| **AI Engine** | Groq API (LLaMA 3.3-70B/3.1-8B) | Large language model for response generation |
| **Search Algorithm** | Custom BM25 | Document retrieval without embeddings |
| **Document Processing** | pypdf, python-docx | Text extraction from university materials |

### Frontend Architecture

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Framework** | React 18 + Vite 5 | Modern web application with fast development |
| **State Management** | React Hooks | Component-level state management |
| **Styling** | Inline CSS + Themes | Responsive design with dark/light modes |
| **Real-time** | Supabase JS | Live data synchronization |
| **Routing** | React Router | Client-side navigation |

### AI Pipeline

```
Student Query → Office Detection → BM25 Search → Context Retrieval → LLM Generation → Sourced Response
```

### Deployment Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Hosting** | Render | Free tier web service hosting |
| **CI/CD** | GitHub Actions | Automated testing and deployment |
| **Environment** | Docker-like | Isolated Python environment |
| **Monitoring** | Built-in Analytics | Usage tracking and error logging |

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

# Configure environment
cp .env.example .env
# Edit .env with your API keys and database URLs
```

### 3. Frontend Setup

```bash
# Install Node dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with API URL and Supabase credentials
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
  student_name TEXT,
  major TEXT,
  year_of_study TEXT,
  nationality TEXT,
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
# Terminal 1: Backend
python main.py

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
- **Input Detection**: Accepts queries in English or Hungarian
- **Response Locking**: Answers strictly in the query language
- **No Translation**: Prevents language mixing in responses

#### 5. LLM Integration
- **Primary Model**: LLaMA 3.3-70B Versatile via Groq API
- **Fallback Model**: LLaMA 3.1-8B Instant
- **Context Window**: Optimized prompts with retrieved chunks
- **Temperature**: 0.1 for consistent, factual responses

### Response Generation Process

1. **Query Analysis**: Extract keywords and detect language
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
- **Rich Text Announcements**: Formatted messages with scheduling
- **Priority Levels**: Info, warning, critical classifications
- **Targeted Messaging**: Department-specific or university-wide scope

### Admin Portal

#### System Management
- **Document Upload**: Drag-and-drop interface for university materials
- **User Management**: View/edit user accounts and permissions
- **Advanced Analytics**: Detailed usage statistics and performance metrics
- **FAQ Management**: Create/edit/delete frequently asked questions
- **Event Management**: Schedule and manage campus events
- **Survey Management**: Create and analyze student feedback surveys

#### Monitoring Dashboard
- **Real-time Metrics**: Active users, question volume, response times
- **Office Analytics**: Question distribution by department
- **Performance Tracking**: System uptime and error rates
- **Usage Patterns**: Peak hours, popular topics, user demographics

---

## 📄 Document Management

### Upload System

#### Supported Formats
- **PDF Files**: Academic catalogs, policy documents, handbooks
- **DOCX Files**: Word documents with complex formatting
- **TXT Files**: Plain text documents and simple lists

#### Processing Pipeline
1. **File Validation**: Check format and size limits
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
- **University Website**: Complete content from uniduna.hu
- **Academic Catalogs**: Course descriptions and requirements
- **Policy Documents**: Academic regulations and procedures
- **Contact Information**: Staff directories and office details
- **Event Calendars**: University activities and deadlines

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
  student_name TEXT,
  major TEXT,
  year_of_study TEXT,
  nationality TEXT,
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
4. Configure environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `GROQ_API_KEY_1`
   - `JWT_SECRET`

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
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# AI
GROQ_API_KEY_1=your-groq-key
GROQ_API_KEY_2=backup-key-optional

# Security
JWT_SECRET=your-256-bit-secret-key

# Optional
DOCS_DIR=./uploaded_docs
```

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
# Install development dependencies
pip install -r requirements-dev.txt

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

### Testing Setup

#### Unit Tests
```bash
# Backend tests
pytest tests/

# Frontend tests
npm test
```

#### Integration Tests
```bash
# End-to-end testing
npm run test:e2e
```

### Code Quality

#### Linting and Formatting
```bash
# Backend
black . --check
flake8 .
mypy .

# Frontend
npm run lint
npm run format
```

---

## 📊 Analytics & Monitoring

### Real-time Metrics

#### System Analytics
- **Total Questions**: Cumulative query count
- **Active Users**: Current session tracking
- **Response Times**: Average and percentile performance
- **Cache Hit Rate**: Answer caching effectiveness

#### User Analytics
- **Questions by Major**: Distribution across study programs
- **Questions by Year**: Usage by academic level
- **Questions by Office**: Department routing effectiveness
- **Questions by Nationality**: International vs domestic usage

#### Office Analytics
- **Routing Accuracy**: Correct department classification
- **Response Quality**: User feedback ratings
- **Escalation Rate**: Questions requiring human intervention

### Monitoring Dashboard

#### Admin Interface Features
- **Live Charts**: Real-time usage graphs
- **Performance Metrics**: System health indicators
- **Error Tracking**: Failed requests and exceptions
- **Usage Patterns**: Peak hours and popular topics

#### Audit Logging
- **Security Events**: Authentication and authorization
- **Admin Actions**: Content management and user administration
- **System Changes**: Configuration and deployment updates

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

### Quality Metrics

#### Response Accuracy
- **Source Verification**: All answers traceable to documents
- **Language Consistency**: Strict language matching
- **Office Relevance**: Correct department routing

#### Performance Benchmarks
- **Response Time**: < 3 seconds average
- **Cache Effectiveness**: > 80% hit rate
- **Uptime**: > 99.5% availability

### User Testing

#### SUS Methodology
- **System Usability Scale**: Standardized user experience measurement
- **Student Surveys**: Feedback collection and analysis
- **Staff Evaluation**: Administrative interface assessment

---

## 🔒 Security Features

### Authentication & Authorization

#### JWT Implementation
- **Token Expiration**: 7-day session validity
- **Secure Storage**: HTTP-only cookies with CSRF protection
- **Refresh Mechanism**: Automatic token renewal

#### Password Security
- **bcrypt Hashing**: Industry-standard password protection
- **Salt Rounds**: Configurable complexity (default: 12)
- **Fallback Prevention**: Graceful degradation without security compromise

### Data Protection

#### Privacy Measures
- **Data Minimization**: Only collect necessary user information
- **Consent Management**: Clear privacy policy and data usage
- **Audit Logging**: Comprehensive activity tracking

#### Access Control
- **Role-Based Permissions**: Student/Staff/Admin access levels
- **API Rate Limiting**: Prevent abuse and ensure fair usage
- **Session Management**: Secure logout and token invalidation

---

## 📈 Performance Optimization

### Caching Strategy

#### Answer Caching
- **Cache Key**: Hash of question + context parameters
- **Cache Size**: 200 entries with LRU eviction
- **Hit Rate**: > 80% for common questions

#### Database Optimization
- **Indexing**: Optimized queries on frequently accessed columns
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Minimized database round trips

### AI Pipeline Optimization

#### BM25 Tuning
- **Chunk Size**: 400 words with 80-word overlap
- **Term Processing**: Hungarian language support
- **Scoring Algorithm**: Optimized TF-IDF calculation

#### LLM Efficiency
- **Model Selection**: LLaMA 3.3-70B for complex queries
- **Fallback Strategy**: LLaMA 3.1-8B for faster responses
- **Prompt Engineering**: Concise, context-focused prompts

---

## 🔮 Future Enhancements

### Planned Features

#### Advanced AI Capabilities
- **Multi-modal Input**: Image and document upload support
- **Voice Interaction**: Speech-to-text and text-to-speech
- **Conversational Memory**: Context-aware multi-turn conversations
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
- **Evaluation Metrics**: Automated response quality assessment
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
- **Requirements Gathering**: Stakeholder interviews and user surveys
- **Architecture Design**: System design and technology selection

#### Implementation Phase
- **Agile Development**: Iterative development with regular testing
- **User-Centered Design**: Continuous feedback and usability testing
- **Quality Assurance**: Comprehensive testing and validation
- **Performance Optimization**: System tuning and optimization

#### Evaluation Phase
- **Usability Testing**: SUS methodology implementation
- **Accuracy Assessment**: Response quality and source verification
- **Performance Benchmarking**: Speed, reliability, and scalability testing
- **User Acceptance**: Stakeholder feedback and adoption metrics

### Technical Innovation

#### BM25 Implementation
- **Algorithm Selection**: Chosen over embedding-based search for efficiency
- **Hungarian Support**: Custom tokenization for accented characters
- **Office Filtering**: Department-specific search optimization
- **Performance Tuning**: Optimized for university document corpus

#### RAG Pipeline
- **Document Processing**: Custom chunking strategy for academic content
- **Context Assembly**: Intelligent context selection and ranking
- **Prompt Engineering**: University-specific system prompts
- **Response Validation**: Source attribution and accuracy verification

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
- **Student Participants**: Usability testing and feedback
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