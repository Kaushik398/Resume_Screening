import re
from collections import Counter

STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "with", "by", "from", "as", "is", "was", "are", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "may", "might", "must", "shall", "can", "need", "dare", "ought", "used", "that",
    "this", "these", "those", "i", "you", "he", "she", "it", "we", "they", "what",
    "which", "who", "whom", "whose", "where", "when", "why", "how", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "just", "also",
    "our", "your", "their", "my", "his", "her", "its", "about", "into", "through",
    "during", "before", "after", "above", "below", "between", "under", "again",
    "further", "then", "once", "here", "there", "any", "both", "each", "few",
    "work", "working", "role", "position", "job", "company", "team", "years",
    "year", "experience", "required", "preferred", "ability", "able", "including",
    "etc", "using", "use", "used", "within", "across", "well", "strong", "good",
}

SKILL_PATTERNS = [
    r"\b(python|java|javascript|typescript|react|angular|vue|node\.?js|django|flask|fastapi)\b",
    r"\b(sql|postgresql|mysql|mongodb|redis|aws|azure|gcp|docker|kubernetes|k8s)\b",
    r"\b(machine learning|deep learning|nlp|data science|analytics|tableau|power bi)\b",
    r"\b(agile|scrum|ci/cd|git|github|gitlab|jenkins|terraform|ansible)\b",
    r"\b(communication|leadership|problem solving|project management)\b",
    r"\b(html|css|rest|api|graphql|microservices|linux|windows)\b",
    r"\b(c\+\+|c#|\.net|ruby|go|golang|rust|kotlin|swift|php|scala)\b",
    r"\b(excel|word|powerpoint|salesforce|sap|oracle)\b",
]


def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s\.\+\#]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize(text: str) -> list[str]:
    normalized = normalize_text(text)
    tokens = [t for t in normalized.split() if len(t) > 2 and t not in STOP_WORDS]
    return tokens


def extract_skills(text: str) -> set[str]:
    skills: set[str] = set()
    lower = text.lower()
    for pattern in SKILL_PATTERNS:
        for match in re.finditer(pattern, lower, re.IGNORECASE):
            skills.add(match.group(1).lower().replace("node.js", "nodejs").replace("node js", "nodejs"))
    # Also pick capitalized tech-like tokens
    for word in re.findall(r"\b[A-Z][a-zA-Z\+#\.]{2,}\b", text):
        if len(word) >= 3:
            skills.add(word.lower())
    return skills


def extract_sections(text: str) -> dict[str, str]:
    sections = {
        "experience": "",
        "education": "",
        "skills": "",
        "summary": "",
    }
    lines = text.split("\n")
    current = "summary"
    headers = {
        "experience": ["experience", "employment", "work history", "professional"],
        "education": ["education", "academic", "qualification"],
        "skills": ["skills", "technical skills", "competencies", "technologies"],
    }
    for line in lines:
        lower = line.strip().lower()
        matched = False
        for key, keywords in headers.items():
            if any(kw in lower for kw in keywords) and len(lower) < 60:
                current = key
                matched = True
                break
        if not matched:
            sections[current] += line + "\n"
    return sections


def word_overlap_score(resume_tokens: list[str], jd_tokens: list[str]) -> float:
    if not jd_tokens:
        return 0.0
    resume_set = set(resume_tokens)
    jd_set = set(jd_tokens)
    if not jd_set:
        return 0.0
    overlap = len(resume_set & jd_set)
    return overlap / len(jd_set)


def top_missing_terms(resume_tokens: list[str], jd_tokens: list[str], n: int = 15) -> list[str]:
    resume_set = set(resume_tokens)
    jd_counts = Counter(jd_tokens)
    missing = [(term, count) for term, count in jd_counts.most_common() if term not in resume_set]
    return [t for t, _ in missing[:n]]
