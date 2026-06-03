from dataclasses import dataclass

from services.text_utils import (
    extract_sections,
    extract_skills,
    tokenize,
    top_missing_terms,
    word_overlap_score,
)


@dataclass

class MatchResult:
    score_percent: float
    passed: bool
    skill_match_percent: float
    keyword_match_percent: float
    matched_skills: list[str]
    missing_skills: list[str]
    focus_phases: list[dict]


def compute_match(resume_text: str, jd_text: str, threshold: float = 75.0) -> MatchResult:
    resume_tokens = tokenize(resume_text)
    jd_tokens = tokenize(jd_text)

    resume_skills = extract_skills(resume_text)
    jd_skills = extract_skills(jd_text)

    keyword_score = word_overlap_score(resume_tokens, jd_tokens) * 100

    if jd_skills:
        matched = resume_skills & jd_skills
        skill_score = (len(matched) / len(jd_skills)) * 100
        missing_skills = sorted(jd_skills - resume_skills)
        matched_skills = sorted(matched)
    else:
        matched_skills = sorted(resume_skills & set(jd_tokens))
        missing_skills = top_missing_terms(resume_tokens, jd_tokens, 10)
        skill_score = keyword_score * 0.9

    # Weighted composite score
    score = round(keyword_score * 0.55 + skill_score * 0.45, 1)
    passed = score >= threshold

    focus_phases = []
    if not passed:
        focus_phases = _build_focus_phases(
            resume_text, jd_text, resume_tokens, jd_tokens, missing_skills
        )

    return MatchResult(
        score_percent=score,
        passed=passed,
        skill_match_percent=round(skill_score, 1),
        keyword_match_percent=round(keyword_score, 1),
        matched_skills=matched_skills[:20],
        missing_skills=missing_skills[:15],
        focus_phases=focus_phases,
    )


def _build_focus_phases(
    resume_text: str,
    jd_text: str,
    resume_tokens: list[str],
    jd_tokens: list[str],
    missing_skills: list[str],
) -> list[dict]:
    sections = extract_sections(resume_text)
    jd_sections = extract_sections(jd_text)

    phases = []

    # Phase 1: Skills gap
    if missing_skills:
        phases.append({
            "phase": "Technical Skills",
            "priority": "high",
            "description": "Strengthen skills that appear in the job description but are missing or weak on your resume.",
            "actions": [
                f"Add or highlight: {', '.join(missing_skills[:8])}",
                "Include projects or certifications that demonstrate these skills",
                "Use the exact terminology from the job posting where honest",
            ],
        })

    # Phase 2: Experience alignment
    exp_resume = tokenize(sections["experience"] or resume_text)
    exp_jd = tokenize(jd_sections["experience"] or jd_text)
    exp_score = word_overlap_score(exp_resume, exp_jd) * 100
    if exp_score < 50:
        phases.append({
            "phase": "Experience & Impact",
            "priority": "high",
            "description": "Your work history does not closely mirror the responsibilities in this role.",
            "actions": [
                "Rewrite bullet points to mirror JD responsibilities using measurable outcomes",
                "Quantify achievements (%, $, time saved, users served)",
                "Reorder experience so the most relevant roles appear first",
            ],
        })

    # Phase 3: Keywords / ATS
    missing_keywords = top_missing_terms(resume_tokens, jd_tokens, 12)
    if missing_keywords:
        phases.append({
            "phase": "Keywords & ATS Optimization",
            "priority": "medium",
            "description": "Important terms from the job description are underrepresented on your resume.",
            "actions": [
                f"Naturally incorporate: {', '.join(missing_keywords[:10])}",
                "Add a tailored summary at the top aligned to this role",
                "Avoid keyword stuffing — integrate terms in context",
            ],
        })

    # Phase 4: Education (if JD mentions degrees)
    edu_jd = sections["education"].lower()
    edu_resume = sections["education"].lower()
    degree_terms = ["bachelor", "master", "phd", "degree", "mba", "b.s", "m.s", "diploma"]
    jd_needs_degree = any(t in edu_jd for t in degree_terms)
    resume_has_degree = any(t in edu_resume for t in degree_terms) or any(
        t in resume_text.lower() for t in degree_terms
    )
    if jd_needs_degree and not resume_has_degree:
        phases.append({
            "phase": "Education & Credentials",
            "priority": "medium",
            "description": "The role may expect formal education or credentials that are not clearly stated.",
            "actions": [
                "Add education section with degree, institution, and graduation year",
                "Include relevant certifications, bootcamps, or coursework",
            ],
        })

    if not phases:
        phases.append({
            "phase": "Overall Profile Alignment",
            "priority": "high",
            "description": "Your resume needs broader alignment with this job description.",
            "actions": [
                "Customize your resume specifically for this posting",
                "Expand your professional summary to address the top 3 JD requirements",
                "Review the full job description and map each requirement to resume content",
            ],
        })

    return phases
