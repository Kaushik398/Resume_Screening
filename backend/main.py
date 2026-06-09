import uuid
import os
import base64
import json
import urllib.request
import urllib.error
from typing import Optional
from dotenv import load_dotenv

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import init_db, get_db, DBCandidate, DBAssessmentAttempt
from services.matching import compute_match
from services.parser import parse_upload
from services.test_generator import generate_test, grade_test
from services.models import ResumeCreate, ScreenTextRequest, TestSubmitRequest
from services.resume_writer import generate_resume_docx

load_dotenv()

app = FastAPI(title="Resume Screening API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MATCH_THRESHOLD = 75.0

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

@app.on_event("startup")
def on_startup():
    # Initialize SQLAlchemy database tables (SQLite platform.db by default)
    init_db()

def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Use 'Bearer <token>'")
    
    token = parts[1]

    # Check if we are in demo mode
    is_demo = not (SUPABASE_URL and SUPABASE_ANON_KEY and 
                   "your-project-id" not in SUPABASE_URL and 
                   "your-anon-public-key" not in SUPABASE_ANON_KEY)

    if is_demo or token.startswith("demo-token-"):
        if not token.startswith("demo-token-"):
            raise HTTPException(status_code=401, detail="In Demo Auth Mode. Please sign in/up with a demo account.")
        try:
            payload_b64 = token[len("demo-token-"):]
            payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
            user_data = json.loads(base64.b64decode(payload_b64).decode("utf-8"))
            return user_data
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid demo session token")
    
    # Real Supabase validation
    req = urllib.request.Request(
        f"{SUPABASE_URL.rstrip('/')}/auth/v1/user",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": SUPABASE_ANON_KEY
        }
    )
    try:
        with urllib.request.urlopen(req) as response:
            user_data = json.loads(response.read().decode("utf-8"))
            return user_data
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")


def resume_from_create(data: ResumeCreate) -> str:
    parts = []
    if data.full_name:
        parts.append(data.full_name.upper())
    if data.email:
        parts.append(f"Email: {data.email}")
    if data.phone:
        parts.append(f"Phone: {data.phone}")
    if data.linkedin:
        parts.append(f"LinkedIn: {data.linkedin}")
    if data.github:
        parts.append(f"GitHub: {data.github}")
    if data.summary:
        parts.append(f"\nSUMMARY\n{data.summary}")
    if data.skills:
        parts.append(f"\nSKILLS\n{data.skills}")
    if data.experience:
        parts.append(f"\nEXPERIENCE\n{data.experience}")
    if data.education:
        parts.append(f"\nEDUCATION\n{data.education}")
    if data.projects:
        parts.append(f"\nPROJECTS\n{data.projects}")
    if data.certifications:
        parts.append(f"\nCERTIFICATIONS\n{data.certifications}")
    if data.achievements:
        parts.append(f"\nACHIEVEMENTS\n{data.achievements}")
    return "\n".join(parts)


def format_ai_resume_fields(data: ResumeCreate) -> dict:
    """Simulates an AI resume polishing engine by rewriting statements using action verbs."""
    summary = data.summary
    if not summary:
        summary = f"Results-driven software professional aiming to leverage expertise in {data.preferred_role or 'software engineering'}. Experienced in implementing high-quality architectures, testing features, and collaborating across teams."
    else:
        if not summary.strip().endswith("."):
            summary += "."
        summary = f"Detail-oriented {data.preferred_role or 'Professional'} with hands-on expertise in {data.skills.split(',')[0] if data.skills else 'software development'}. " + summary
        
    raw_exp = data.experience or ""
    polished_exp = []
    for line in raw_exp.split("\n"):
        line = line.strip()
        if not line:
            continue
        if line.startswith(("-", "*")):
            line = line[1:].strip()
            
        # AI Rewrite simulation using action verbs
        if "responsible for" in line.lower():
            idx = line.lower().find("responsible for")
            line = "Spearheaded " + line[idx+15:].strip()
        elif "i worked on" in line.lower() or "i built" in line.lower():
            line = "Engineered and deployed " + line.replace("I worked on", "").replace("I built", "").strip()
        elif "i helped" in line.lower() or "helped to" in line.lower():
            line = "Collaborated on " + line.replace("I helped", "").replace("helped to", "").strip()
        elif not any(line.startswith(v) for v in ["Spearheaded", "Engineered", "Designed", "Implemented", "Developed", "Optimized", "Collaborated", "Architected"]):
            line = "Developed " + line
            
        # Ensure it starts with bullet point
        polished_exp.append(f"- {line}")
        
    experience_polished = "\n".join(polished_exp) if polished_exp else "- Engineered high-quality component layers and resolved structural technical blockers.\n- Collaborated with developers to align responsive platform layouts."
    
    return {
        "full_name": data.full_name or "Anonymous Candidate",
        "email": data.email or "candidate@example.com",
        "phone": data.phone or "+1 555-0100",
        "linkedin": data.linkedin or "linkedin.com/in/candidate",
        "github": data.github or "github.com/candidate",
        "summary": summary,
        "skills": data.skills or "React, Python, SQL, JavaScript, Git, REST APIs",
        "experience": experience_polished,
        "education": data.education or "B.S. in Computer Science",
        "projects": data.projects or "Personal Portfolio - Designed full-stack platform using FastAPI and React.",
        "certifications": data.certifications or "AWS Certified Solutions Architect",
        "achievements": data.achievements or "Won 1st place in local hackathon (100+ candidates)"
    }


def _screen_response(resume_text: str, jd_text: str, candidate_info: dict, db: Session) -> dict:
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Resume content is empty.")
    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="Job description is empty.")

    match = compute_match(resume_text, jd_text, MATCH_THRESHOLD)
    
    # Calculate qualification status based on score
    score = match.score_percent
    if score >= 80.0:
        match_status = "Qualified"
    elif score >= 50.0:
        match_status = "Partially Qualified"
    else:
        match_status = "Not Qualified"
        
    # JSON bundle of screening details for storage
    details = {
        "keyword_match_percent": match.keyword_match_percent,
        "skill_match_percent": match.skill_match_percent,
        "matched_skills": match.matched_skills,
        "missing_skills": match.missing_skills,
        "focus_phases": match.focus_phases if hasattr(match, 'focus_phases') else []
    }
    
    # Check if this candidate already exists in database
    email = candidate_info.get("email") or "anonymous@candidate.com"
    candidate = db.query(DBCandidate).filter(DBCandidate.email == email).first()
    
    if not candidate:
        candidate = DBCandidate(
            full_name=candidate_info.get("full_name") or "Anonymous Candidate",
            email=email,
            phone=candidate_info.get("phone") or "",
            linkedin=candidate_info.get("linkedin") or "",
            github=candidate_info.get("github") or "",
            preferred_role=candidate_info.get("preferred_role") or "Software Engineer",
            resume_text=resume_text,
            ats_score=score,
            match_status=match_status,
            screening_details=json.dumps(details),
            shortlisted=False
        )
        db.add(candidate)
    else:
        # Update score and details if they re-run screening
        candidate.ats_score = score
        candidate.match_status = match_status
        candidate.resume_text = resume_text
        candidate.screening_details = json.dumps(details)
        if candidate_info.get("full_name"):
            candidate.full_name = candidate_info["full_name"]
        if candidate_info.get("phone"):
            candidate.phone = candidate_info["phone"]
            
    db.commit()
    db.refresh(candidate)

    result = {
        "candidate_id": candidate.id,
        "match_score": score,
        "passed": score >= 70.0,  # Screening generates assessment if ATS score > 70%
        "threshold": MATCH_THRESHOLD,
        "skill_match_percent": match.skill_match_percent,
        "keyword_match_percent": match.keyword_match_percent,
        "matched_skills": match.matched_skills,
        "missing_skills": match.missing_skills,
        "decision": match_status
    }

    if score >= 70.0:
        session_id = str(uuid.uuid4())
        # Generate assessment using skills in JD and resume
        test = generate_test(jd_text, session_id, difficulty="medium", max_questions=5, resume_text=resume_text)
        
        # Save assessment attempt in the database
        attempt = DBAssessmentAttempt(
            candidate_id=candidate.id,
            session_id=session_id,
            questions_json=json.dumps(test["questions"]),
            answers_json="{}",
            test_score=None,
            feedback_json="{}"
        )
        db.add(attempt)
        db.commit()
        
        result["test"] = test
        result["message"] = (
            f"ATS Score is {score}% ({match_status}). Congratulations! You are eligible for an AI-generated assessment. Complete the test below."
        )
    else:
        result["focus_phases"] = match.focus_phases
        result["message"] = (
            f"ATS Score is {score}% ({match_status}). This is below the required 70% assessment threshold. Review feedback keywords below to improve your profile."
        )

    return result


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/resume/create")
def create_resume(data: ResumeCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    text = resume_from_create(data)
    # Check if a candidate with this user email exists
    email = user.get("email") or "anonymous@candidate.com"
    candidate = db.query(DBCandidate).filter(DBCandidate.email == email).first()
    if not candidate:
        candidate = DBCandidate(
            full_name=data.full_name or "Anonymous Candidate",
            email=email,
            phone=data.phone or "",
            linkedin=data.linkedin or "",
            github=data.github or "",
            preferred_role=data.preferred_role or "Software Engineer",
            resume_text=text
        )
        db.add(candidate)
    else:
        candidate.resume_text = text
        candidate.full_name = data.full_name or candidate.full_name
        candidate.phone = data.phone or candidate.phone
        candidate.linkedin = data.linkedin or candidate.linkedin
        candidate.github = data.github or candidate.github
        candidate.preferred_role = data.preferred_role or candidate.preferred_role
    db.commit()
    return {"resume_text": text, "message": "Resume created and saved successfully."}


@app.post("/api/resume/generate-ai")
def generate_ai_resume(data: ResumeCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Clean and rewrite the fields using the simulated AI professional writing assistant
    polished_fields = format_ai_resume_fields(data)
    text = resume_from_create(ResumeCreate(**polished_fields))
    
    # Save the polished resume structure
    email = user.get("email") or "anonymous@candidate.com"
    candidate = db.query(DBCandidate).filter(DBCandidate.email == email).first()
    
    if not candidate:
        candidate = DBCandidate(
            full_name=polished_fields["full_name"],
            email=email,
            phone=polished_fields["phone"],
            linkedin=polished_fields["linkedin"],
            github=polished_fields["github"],
            preferred_role=data.preferred_role or "Software Engineer",
            resume_text=text,
            screening_details=json.dumps({"polished_fields": polished_fields})
        )
        db.add(candidate)
    else:
        candidate.resume_text = text
        candidate.full_name = polished_fields["full_name"]
        candidate.phone = polished_fields["phone"]
        candidate.linkedin = polished_fields["linkedin"]
        candidate.github = polished_fields["github"]
        candidate.preferred_role = data.preferred_role or candidate.preferred_role
        
        # Load existing details or init
        try:
            curr_details = json.loads(candidate.screening_details) if candidate.screening_details else {}
        except Exception:
            curr_details = {}
        curr_details["polished_fields"] = polished_fields
        candidate.screening_details = json.dumps(curr_details)
        
    db.commit()
    db.refresh(candidate)
    
    return {
        "candidate_id": candidate.id,
        "resume_text": text,
        "polished_fields": polished_fields,
        "message": "AI Resume generated and structured successfully."
    }


@app.get("/api/resume/download/docx")
def download_resume_docx_current(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    email = user.get("email") or "anonymous@candidate.com"
    candidate = db.query(DBCandidate).filter(DBCandidate.email == email).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="No resume generated yet. Complete AI Resume builder first.")
        
    # Attempt to extract polished fields
    polished_fields = {}
    if candidate.screening_details:
        try:
            details = json.loads(candidate.screening_details)
            polished_fields = details.get("polished_fields", {})
        except Exception:
            pass
            
    if not polished_fields:
        # Fall back to splitting resume text roughly
        polished_fields = {
            "full_name": candidate.full_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "linkedin": candidate.linkedin,
            "github": candidate.github,
            "summary": "Professional profile summary.",
            "skills": "React, Python, SQL",
            "experience": candidate.resume_text,
            "education": "B.S. in Computer Science"
        }
        
    file_bytes = generate_resume_docx(polished_fields)
    filename = f"{candidate.full_name.replace(' ', '_')}_Resume.docx"
    
    return StreamingResponse(
        Response(content=file_bytes, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/api/screen")
def screen_text(body: ScreenTextRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    candidate_info = {
        "full_name": body.full_name or user.get("name") or user.get("email", "").split("@")[0].title(),
        "email": body.email or user.get("email"),
        "phone": body.phone or "",
        "preferred_role": body.preferred_role or "Software Engineer"
    }
    return _screen_response(body.resume_text, body.jd_text, candidate_info, db)


@app.post("/api/screen/upload")
async def screen_upload(
    resume_file: Optional[UploadFile] = File(None),
    jd_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    jd_text: Optional[str] = Form(None),
    full_name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    preferred_role: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    r_text = resume_text or ""
    j_text = jd_text or ""

    if resume_file and resume_file.filename:
        content = await resume_file.read()
        try:
            r_text = parse_upload(resume_file.filename, content)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    if jd_file and jd_file.filename:
        content = await jd_file.read()
        try:
            j_text = parse_upload(jd_file.filename, content)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    candidate_info = {
        "full_name": full_name or user.get("name") or user.get("email", "").split("@")[0].title(),
        "email": email or user.get("email"),
        "phone": phone or "",
        "preferred_role": preferred_role or "Software Engineer"
    }

    return _screen_response(r_text, j_text, candidate_info, db)


@app.post("/api/test/submit")
def submit_test(body: TestSubmitRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Retrieve the active attempt from db
    attempt = db.query(DBAssessmentAttempt).filter(DBAssessmentAttempt.session_id == body.session_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Test session not found or expired.")
        
    # Load original questions from database to grade correctly
    questions = json.loads(attempt.questions_json)
    
    # Temporarily reconstruct session in generator memory so grade_test functions
    from services.test_generator import _test_sessions
    _test_sessions[body.session_id] = {
        "questions": questions,
        "jd_preview": ""
    }
    
    result = grade_test(body.session_id, body.answers)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
        
    # Save test results in the database
    attempt.answers_json = json.dumps(body.answers)
    attempt.test_score = result["score_percent"]
    attempt.feedback_json = json.dumps(result["feedback"])
    db.commit()
    
    return result


@app.get("/api/candidates")
def get_candidates(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # Recruiter view
    candidates = db.query(DBCandidate).order_by(DBCandidate.ats_score.desc()).all()
    results = []
    for c in candidates:
        # Fetch their latest test score
        latest_attempt = db.query(DBAssessmentAttempt).filter(DBAssessmentAttempt.candidate_id == c.id).order_by(DBAssessmentAttempt.created_at.desc()).first()
        
        screening_details = {}
        try:
            screening_details = json.loads(c.screening_details) if c.screening_details else {}
        except Exception:
            pass
            
        test_score = latest_attempt.test_score if latest_attempt else None
        feedback = {}
        if latest_attempt and latest_attempt.feedback_json:
            try:
                feedback = json.loads(latest_attempt.feedback_json)
            except Exception:
                pass
                
        results.append({
            "id": c.id,
            "full_name": c.full_name,
            "email": c.email,
            "phone": c.phone,
            "linkedin": c.linkedin,
            "github": c.github,
            "preferred_role": c.preferred_role,
            "ats_score": c.ats_score,
            "match_status": c.match_status,
            "shortlisted": c.shortlisted,
            "created_at": c.created_at.strftime("%Y-%m-%d %H:%M"),
            "test_score": test_score,
            "test_feedback": feedback,
            "screening_details": screening_details
        })
    return results


@app.post("/api/candidates/{id}/shortlist")
def toggle_shortlist(id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    candidate = db.query(DBCandidate).filter(DBCandidate.id == id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate.shortlisted = not candidate.shortlisted
    db.commit()
    return {"id": candidate.id, "shortlisted": candidate.shortlisted, "message": f"Candidate shortlisted state set to {candidate.shortlisted}"}


@app.get("/api/recruiter/analytics")
def get_analytics(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    candidates = db.query(DBCandidate).all()
    total = len(candidates)
    
    qualified = sum(1 for c in candidates if c.ats_score >= 75.0)
    avg_ats = round(sum(c.ats_score for c in candidates) / total, 1) if total else 0.0
    
    attempts = db.query(DBAssessmentAttempt).filter(DBAssessmentAttempt.test_score != None).all()
    tests_completed = len(attempts)
    
    # Skills distribution
    skills_counter = Counter()
    for c in candidates:
        # Load matched skills
        if c.screening_details:
            try:
                details = json.loads(c.screening_details)
                matched = details.get("matched_skills", [])
                for skill in matched:
                    skills_counter[skill.upper()] += 1
            except Exception:
                pass
                
    # Format skills distribution for chart (top 5)
    skills_dist = [{"skill": k, "count": v} for k, v in skills_counter.most_common(5)]
    
    return {
        "total_candidates": total,
        "qualified_candidates": qualified,
        "average_ats": avg_ats,
        "tests_completed": tests_completed,
        "skills_distribution": skills_dist
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
