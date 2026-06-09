from pydantic import BaseModel, Field
from typing import Optional, List, Dict

class ResumeCreate(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    github: str = ""
    summary: str = ""
    skills: str = ""
    experience: str = ""
    education: str = ""
    projects: str = ""
    certifications: str = ""
    achievements: str = ""
    preferred_role: str = ""


class ScreenTextRequest(BaseModel):
    resume_text: str
    jd_text: str
    full_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    preferred_role: Optional[str] = ""


class TestSubmitRequest(BaseModel):
    session_id: str
    answers: dict[str, int] = Field(default_factory=dict)