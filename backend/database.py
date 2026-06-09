import os
import json
import datetime
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# We fall back to a local SQLite database file in the backend directory
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./platform.db")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DBUser(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    full_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class DBCandidate(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True, default="")
    email = Column(String, index=True, default="")
    phone = Column(String, nullable=True, default="")
    linkedin = Column(String, nullable=True, default="")
    github = Column(String, nullable=True, default="")
    preferred_role = Column(String, nullable=True, default="")
    resume_text = Column(Text, nullable=True, default="")
    ats_score = Column(Float, default=0.0)
    match_status = Column(String, default="Not Qualified")  # Qualified, Partially Qualified, Not Qualified
    screening_details = Column(Text, nullable=True, default="")  # JSON containing strengths, weaknesses, keywords
    shortlisted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    attempts = relationship("DBAssessmentAttempt", back_populates="candidate", cascade="all, delete-orphan")

class DBAssessmentAttempt(Base):
    __tablename__ = "assessment_attempts"
    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id", ondelete="CASCADE"))
    session_id = Column(String, unique=True, index=True)
    questions_json = Column(Text, nullable=True, default="[]")  # JSON representation of unique test questions
    answers_json = Column(Text, nullable=True, default="{}")    # JSON representation of selected options
    test_score = Column(Float, nullable=True)
    feedback_json = Column(Text, nullable=True, default="{}")   # JSON report with radar chart dimensions, recommendations
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    candidate = relationship("DBCandidate", back_populates="attempts")

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
