# Resume Screening Application

Screen candidates by matching resumes to job descriptions (JD). If the match score is **75% or higher**, the app generates a short assessment (up to 5 questions) from the JD and provides feedback after submission. If the score is below 75%, it shows **focus phases** to improve the resume for that role.

## Features

- **Upload or paste resume** — Primary path (PDF, DOCX, TXT)
- **Create resume (optional)** — Build a resume only if you do not have one yet
- **Job description** — Paste text or upload separately (PDF/DOCX/TXT)
- **Match scoring** — Keyword + skills overlap (75% pass threshold)
- **Assessment** — Up to 5 MCQs when match ≥ 75%
- **Feedback** — Performance summary and recommendations after the test
- **Focus phases** — Actionable improvement areas when match &lt; 75%

## Quick Start

### Backend (Python 3.10+)

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

**Both servers must be running.** If you see "connection failed", the backend is usually not started.

**Easy start (Windows):** from the project folder run:

```powershell
.\start.ps1
```

This opens two terminals (backend + frontend). The UI calls `http://127.0.0.1:8000/api` directly.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/resume/create` | Build resume from form JSON |
| POST | `/api/screen` | Screen with `resume_text` + `jd_text` |
| POST | `/api/screen/upload` | Screen with file uploads (multipart) |
| POST | `/api/test/submit` | Grade test and return feedback |

## Project Structure

```
intern/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── services/
│       ├── matching.py      # 75% threshold & focus phases
│       ├── test_generator.py  # Questions & feedback
│       ├── parser.py          # PDF/DOCX/TXT extraction
│       └── text_utils.py
└── frontend/
    └── src/App.jsx            # UI flows
```

## Notes

- Matching uses keyword overlap and skill detection (no external API required).
- Test questions are derived from JD topics and skills.
- For production, replace in-memory test sessions with a database and consider LLM-based matching for higher accuracy.
