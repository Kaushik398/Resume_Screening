from pydantic import BaseModel, Field

class ResumeCreate(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    summary: str = ""
    skills: str = ""
    experience: str = ""
    education: str = ""


class ScreenTextRequest(BaseModel):
    resume_text: str
    jd_text: str


class TestSubmitRequest(BaseModel):
    session_id: str
    answers: dict[str, int] = Field(default_factory=dict)