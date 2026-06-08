import uuid
import os
import base64
import json
import urllib.request
import urllib.error
from typing import Optional
from dotenv import load_dotenv

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, Header
from fastapi.middleware.cors import CORSMiddleware

from services.matching import compute_match
from services.parser import parse_upload
from services.test_generator import generate_test, grade_test
from services.models import ResumeCreate, ScreenTextRequest, TestSubmitRequest

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
    if data.summary:
        parts.append(f"\nSUMMARY\n{data.summary}")
    if data.skills:
        parts.append(f"\nSKILLS\n{data.skills}")
    if data.experience:
        parts.append(f"\nEXPERIENCE\n{data.experience}")
    if data.education:
        parts.append(f"\nEDUCATION\n{data.education}")
    return "\n".join(parts)


def _screen_response(resume_text: str, jd_text: str) -> dict:
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Resume content is empty.")
    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="Job description is empty.")

    match = compute_match(resume_text, jd_text, MATCH_THRESHOLD)
    result = {
        "match_score": match.score_percent,
        "passed": match.passed,
        "threshold": MATCH_THRESHOLD,
        "skill_match_percent": match.skill_match_percent,
        "keyword_match_percent": match.keyword_match_percent,
        "matched_skills": match.matched_skills,
        "missing_skills": match.missing_skills,
    }

    if match.passed:
        session_id = str(uuid.uuid4())
        test = generate_test(jd_text, session_id, max_questions=5)
        result["test"] = test
        result["message"] = (
            f"Match score {match.score_percent}% meets the {MATCH_THRESHOLD}% threshold. "
            "Complete the assessment below."
        )
    else:
        result["focus_phases"] = match.focus_phases
        result["message"] = (
            f"Match score {match.score_percent}% is below the {MATCH_THRESHOLD}% threshold. "
            "Review the focus areas below to improve your profile."
        )

    return result


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/resume/create")
def create_resume(data: ResumeCreate, user: dict = Depends(get_current_user)):
    text = resume_from_create(data)
    return {"resume_text": text, "message": "Resume created successfully."}


@app.post("/api/screen")
def screen_text(body: ScreenTextRequest, user: dict = Depends(get_current_user)):
    return _screen_response(body.resume_text, body.jd_text)


@app.post("/api/screen/upload")
async def screen_upload(
    resume_file: Optional[UploadFile] = File(None),
    jd_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    jd_text: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
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

    return _screen_response(r_text, j_text)


@app.post("/api/test/submit")
def submit_test(body: TestSubmitRequest, user: dict = Depends(get_current_user)):
    result = grade_test(body.session_id, body.answers)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

import uvicorn
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
