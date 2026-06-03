import random
import re
from collections import Counter

from services.text_utils import extract_skills, tokenize

# In-memory store for test sessions (simple demo; use DB in production)
_test_sessions: dict[str, dict] = {}


def _extract_jd_topics(jd_text: str, max_topics: int = 5) -> list[str]:
    skills = list(extract_skills(jd_text))
    tokens = tokenize(jd_text)
    token_counts = Counter(tokens)
    top_words = [w for w, _ in token_counts.most_common(30) if len(w) > 4]

    topics: list[str] = []
    for s in skills:
        if s not in topics:
            topics.append(s.title())
    for w in top_words:
        label = w.title()
        if label not in topics and len(topics) < max_topics:
            topics.append(label)

    # Fallback from sentences
    if len(topics) < max_topics:
        sentences = re.split(r"[.!?]\s+", jd_text)
        for sent in sentences:
            if len(sent) > 40 and len(topics) < max_topics:
                short = sent.strip()[:80]
                if short not in topics:
                    topics.append(short[:60] + ("..." if len(short) > 60 else ""))

    while len(topics) < max_topics:
        topics.append(f"Role Requirement {len(topics) + 1}")

    return topics[:max_topics]


def _make_distractors(correct: str, pool: list[str]) -> list[str]:
    distractors = [d for d in pool if d.lower() != correct.lower()][:3]
    generic = [
        "Not applicable to this role",
        "Optional but not required",
        "Only relevant for senior leadership",
        "Deprecated in current industry practice",
    ]
    while len(distractors) < 3:
        for g in generic:
            if g not in distractors:
                distractors.append(g)
            if len(distractors) >= 3:
                break
    return distractors[:3]


def generate_test(jd_text: str, session_id: str, max_questions: int = 5) -> dict:
    topics = _extract_jd_topics(jd_text, max_questions)
    all_skills = [s.title() for s in extract_skills(jd_text)]
    pool = all_skills + topics

    questions = []
    for i, topic in enumerate(topics):
        correct_idx = random.randint(0, 3)
        distractors = _make_distractors(topic, pool)
        options = distractors.copy()
        options.insert(correct_idx, topic)
        # Ensure 4 unique options
        seen = set()
        unique_opts = []
        for o in options:
            key = o.lower()
            if key not in seen:
                seen.add(key)
                unique_opts.append(o)
        while len(unique_opts) < 4:
            unique_opts.append(f"Alternative {len(unique_opts)}")
        options = unique_opts[:4]
        correct_answer = options[correct_idx] if correct_idx < len(options) else options[0]
        # Re-find correct index
        try:
            correct_idx = options.index(topic)
            correct_answer = topic
        except ValueError:
            correct_idx = 0
            correct_answer = options[0]

        questions.append({
            "id": f"q{i + 1}",
            "question": f"According to the job description, which of the following is most relevant to '{topic}'?",
            "options": options,
            "correct_index": correct_idx,
        })

    _test_sessions[session_id] = {
        "questions": questions,
        "jd_preview": jd_text[:500],
    }

    # Return without correct answers
    public_questions = [
        {"id": q["id"], "question": q["question"], "options": q["options"]}
        for q in questions
    ]
    return {
        "session_id": session_id,
        "max_questions": max_questions,
        "questions": public_questions,
    }


def grade_test(session_id: str, answers: dict[str, int]) -> dict:
    session = _test_sessions.get(session_id)
    if not session:
        return {"error": "Test session not found or expired. Please run screening again."}

    questions = session["questions"]
    total = len(questions)
    correct = 0
    breakdown = []

    for q in questions:
        qid = q["id"]
        user_idx = answers.get(qid)
        is_correct = user_idx is not None and user_idx == q["correct_index"]
        if is_correct:
            correct += 1
        breakdown.append({
            "id": qid,
            "question": q["question"],
            "your_answer": q["options"][user_idx] if user_idx is not None and 0 <= user_idx < len(q["options"]) else "No answer",
            "correct_answer": q["options"][q["correct_index"]],
            "is_correct": is_correct,
        })

    score_percent = round((correct / total) * 100, 1) if total else 0
    feedback = _generate_feedback(score_percent, correct, total)

    del _test_sessions[session_id]

    return {
        "score_percent": score_percent,
        "correct_count": correct,
        "total_questions": total,
        "breakdown": breakdown,
        "feedback": feedback,
    }


def _generate_feedback(score: float, correct: int, total: int) -> dict:
    if score >= 90:
        level = "excellent"
        summary = "Outstanding performance. You demonstrate strong familiarity with the role requirements."
        recommendations = [
            "Proceed to the interview stage with confidence",
            "Prepare specific examples that map to each JD requirement",
            "Research the company culture and recent projects",
        ]
    elif score >= 70:
        level = "good"
        summary = "Solid performance with room to sharpen a few areas before interviewing."
        recommendations = [
            "Review questions you missed and study those JD topics in depth",
            "Prepare STAR-format stories for weak areas",
            "Re-read the full job description and align talking points",
        ]
    elif score >= 50:
        level = "fair"
        summary = "Partial understanding of the role. Additional preparation is recommended."
        recommendations = [
            "Focus study on technical and domain terms from the job posting",
            "Update your resume to highlight gaps identified in screening",
            "Consider short courses or projects in missing skill areas",
        ]
    else:
        level = "needs_improvement"
        summary = "The test suggests limited alignment with this role's requirements right now."
        recommendations = [
            "Thoroughly review the job description before reapplying",
            "Build 1–2 portfolio projects demonstrating required skills",
            "Seek mentorship or training in core competencies listed in the JD",
        ]

    return {
        "level": level,
        "summary": summary,
        "recommendations": recommendations,
        "message": f"You answered {correct} out of {total} questions correctly ({score}%).",
    }
