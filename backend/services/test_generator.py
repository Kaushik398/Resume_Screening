import random
import re
from collections import Counter
from services.text_utils import extract_skills, tokenize

# In-memory store for active test sessions
_test_sessions: dict[str, dict] = {}

# Rich pool of technical, coding, scenario, and aptitude questions based on keywords
QUESTION_LIBRARY = {
    "python": {
        "easy": [
            {
                "type": "Technical MCQ",
                "question": "Which of the following data structures in Python is mutable and guarantees unique elements?",
                "options": ["list", "tuple", "set", "dict"],
                "correct_index": 2,
                "explanation": "A Python set is mutable and enforces unique elements, whereas list and tuple allow duplicates, and tuple is immutable."
            },
            {
                "type": "Coding Question",
                "question": "Given the list comprehension `[x**2 for x in range(5) if x % 2 == 0]`, what is the generated list?",
                "options": ["[0, 4, 16]", "[0, 1, 4, 9, 16]", "[1, 9]", "[4, 16]"],
                "correct_index": 0,
                "explanation": "The range(5) contains numbers [0, 1, 2, 3, 4]. The condition checks if x is even (0, 2, 4), and squares them, producing [0, 4, 16]."
            }
        ],
        "medium": [
            {
                "type": "Coding Question",
                "question": "What is the time complexity of lookup and insert operations in a Python dictionary in the average case?",
                "options": ["O(1)", "O(log N)", "O(N)", "O(N log N)"],
                "correct_index": 0,
                "explanation": "Python dictionaries are implemented as hash tables, providing average O(1) time complexity for lookup and insert."
            },
            {
                "type": "Scenario-Based Question",
                "question": "You are writing a Python service that processes a massive file line-by-line. To prevent high memory usage, which construct should you use?",
                "options": ["A deep list comprehension", "A Generator using `yield`", "Loading the entire file with `f.read()`", "Multi-processing Pool"],
                "correct_index": 1,
                "explanation": "Generators yield lines one-by-one, keeping memory footprint low (O(1) memory), whereas reading the whole file loads it entirely into RAM."
            }
        ],
        "hard": [
            {
                "type": "Technical MCQ",
                "question": "How does Python's Global Interpreter Lock (GIL) impact multi-threaded CPU-bound programs?",
                "options": [
                    "It speeds up execution by parallelizing calculations across all cores",
                    "It prevents threads from running concurrently, making CPU-bound multi-threading run on a single core",
                    "It locks database transactions globally to ensure concurrency safety",
                    "It automatically converts CPU-bound code into asynchronous coroutines"
                ],
                "correct_index": 1,
                "explanation": "The GIL permits only one thread to execute Python bytecode at a time. Therefore, multi-threaded CPU-bound programs do not gain parallel speedups."
            }
        ]
    },
    "react": {
        "easy": [
            {
                "type": "Technical MCQ",
                "question": "In React, which hook is primarily used to perform side effects like fetching data or updating the DOM?",
                "options": ["useState", "useEffect", "useContext", "useReducer"],
                "correct_index": 1,
                "explanation": "useEffect is designed to run side effects in functional React components."
            },
            {
                "type": "Scenario-Based Question",
                "question": "You want to pass data through the component tree without passing props down manually at every level. Which React feature is best suited?",
                "options": ["React Redux", "React Context API", "React Router", "React Portals"],
                "correct_index": 1,
                "explanation": "React Context API provides a way to pass data down the component tree without manual prop drilling."
            }
        ],
        "medium": [
            {
                "type": "Coding Question",
                "question": "Why would you wrap a child component in `React.memo` or use `useCallback` on a callback passed to it?",
                "options": [
                    "To force the child component to re-render on every parent change",
                    "To prevent unnecessary re-renders of the child component when parent props do not change",
                    "To execute an asynchronous fetch inside the child component automatically",
                    "To bind the child component directly to the global Redux store"
                ],
                "correct_index": 1,
                "explanation": "useCallback returns a memoized version of the callback, and React.memo skips re-rendering the child component if props remain identical."
            },
            {
                "type": "Scenario-Based Question",
                "question": "Your React application is lagging because a complex list of items is recalculated on every render. Which hook should you use to cache this value?",
                "options": ["useRef", "useEffect", "useMemo", "useLayoutEffect"],
                "correct_index": 2,
                "explanation": "useMemo memoizes (caches) computed values, recalculating them only when dependencies change."
            }
        ],
        "hard": [
            {
                "type": "Technical MCQ",
                "question": "Under React 18 Concurrent Mode, how does the `useTransition` hook work to improve responsiveness?",
                "options": [
                    "It forces all state updates to execute synchronously to prevent race conditions",
                    "It marks state updates as non-urgent, allowing the browser to keep the UI responsive while rendering in the background",
                    "It automatically creates Web Workers for heavy DOM calculations",
                    "It animations page transitions using hardware-accelerated CSS filters"
                ],
                "correct_index": 1,
                "explanation": "useTransition lets you mark updates as transitions, making them interruptible. This prevents slow re-renders from locking the browser thread."
            }
        ]
    },
    "sql": {
        "easy": [
            {
                "type": "Technical MCQ",
                "question": "Which SQL clause is used to filter records returned by a query based on a specific criteria?",
                "options": ["GROUP BY", "WHERE", "ORDER BY", "HAVING"],
                "correct_index": 1,
                "explanation": "The WHERE clause filters rows before grouping, whereas HAVING filters groups after GROUP BY."
            }
        ],
        "medium": [
            {
                "type": "Technical MCQ",
                "question": "What is the key difference between a LEFT JOIN and an INNER JOIN in SQL?",
                "options": [
                    "LEFT JOIN returns only matching rows from both tables",
                    "LEFT JOIN returns all rows from the left table and matched rows from the right table, filling nulls if no match exists",
                    "INNER JOIN is faster because it operates only on primary keys",
                    "LEFT JOIN deletes unlinked records in the target database"
                ],
                "correct_index": 1,
                "explanation": "A LEFT JOIN returns all records from the left table and matching records from the right, returning NULL values for missing matches."
            },
            {
                "type": "Scenario-Based Question",
                "question": "Your reporting dashboard runs a query that aggregates millions of customer rows. The query has slowed down significantly. What is the first optimization step?",
                "options": [
                    "Re-indexing the database completely",
                    "Adding an index on the columns used in the JOIN, WHERE, and GROUP BY clauses",
                    "Splitting the tables into multiple databases",
                    "Changing the database type to NoSQL"
                ],
                "correct_index": 1,
                "explanation": "Creating targeted indexes on filter, join, and grouping keys is the most effective first step for database query optimization."
            }
        ],
        "hard": [
            {
                "type": "Coding Question",
                "question": "Which SQL Window Function would you use to find the highest salary in each department without collapsing the rows?",
                "options": [
                    "MAX(salary) OVER(PARTITION BY department_id)",
                    "GROUP BY department_id HAVING MAX(salary)",
                    "DENSE_RANK() OVER(ORDER BY salary DESC)",
                    "FIRST_VALUE(salary) GROUP BY department_id"
                ],
                "correct_index": 0,
                "explanation": "Using MAX(salary) OVER(PARTITION BY department_id) returns the maximum salary for each row's department without collapsing rows like GROUP BY."
            }
        ]
    },
    "system_design": {
        "easy": [
            {
                "type": "Technical MCQ",
                "question": "In web architectures, what is the primary role of a Load Balancer?",
                "options": [
                    "To back up the SQL database",
                    "To distribute incoming network traffic across multiple servers",
                    "To encrypt all passwords using bcrypt",
                    "To speed up CSS compilation times"
                ],
                "correct_index": 1,
                "explanation": "Load balancers distribute traffic across a pool of servers to improve availability and horizontal scalability."
            }
        ],
        "medium": [
            {
                "type": "Scenario-Based Question",
                "question": "Your API is experiencing high latency due to repetitive, heavy database reads of static configuration data. Which caching strategy is best?",
                "options": [
                    "Setting up a write-through Redis cache layer",
                    "In-memory local caching (like Memcached or Redis) with a TTL",
                    "Running database backups every hour",
                    "Using client-side localStorage exclusively"
                ],
                "correct_index": 1,
                "explanation": "An in-memory cache layer with Time-To-Live (TTL) is standard for caching read-heavy, low-changing configuration data."
            }
        ],
        "hard": [
            {
                "type": "Technical MCQ",
                "question": "According to the CAP Theorem, when a network partition occurs in a distributed system, what trade-off must be made?",
                "options": [
                    "Latency vs Throughput",
                    "Consistency vs Availability",
                    "Encryption vs Performance",
                    "Reliability vs Security"
                ],
                "correct_index": 1,
                "explanation": "The CAP theorem states that under a network partition, a distributed system must choose either Consistency (C) or Availability (A)."
            }
        ]
    },
    "aptitude": {
        "easy": [
            {
                "type": "Aptitude Question",
                "question": "A server rack contains 4 nodes. If the failure probability of any single node is 10%, and nodes fail independently, what is the probability that all 4 nodes fail?",
                "options": ["0.01%", "0.1%", "10%", "40%"],
                "correct_index": 0,
                "explanation": "For independent events, the joint probability is the product of individual probabilities: 0.1 * 0.1 * 0.1 * 0.1 = 0.0001 (0.01%)."
            }
        ],
        "medium": [
            {
                "type": "Aptitude Question",
                "question": "An API rate limiter allows 100 requests per minute. If a crawler makes 5 requests every 2 seconds, in how many seconds will it exceed the rate limit?",
                "options": ["20 seconds", "40 seconds", "45 seconds", "Never"],
                "correct_index": 1,
                "explanation": "5 requests per 2 seconds equals 2.5 requests per second. The limit is 100 requests per 60 seconds (1.67 requests/sec). The rate of requests is 2.5 * T. 100 / 2.5 = 40 seconds."
            }
        ],
        "hard": [
            {
                "type": "Aptitude Question",
                "question": "A database index speeds up search queries from O(N) to O(log N). If a table has 1,000,000 rows, approximately how many comparisons are saved by using the index?",
                "options": ["10", "1,000", "999,980", "100,000"],
                "correct_index": 2,
                "explanation": "O(N) needs up to 1,000,000 comparisons. O(log2 N) for 1,000,000 is approximately 20 (since 2^20 ≈ 1,048,576). The saved comparisons is 1,000,000 - 20 = 999,980."
            }
        ]
    }
}

def generate_test(jd_text: str, session_id: str, difficulty: str = "medium", max_questions: int = 5, resume_text: str = "") -> dict:
    skills = [s.lower() for s in extract_skills(jd_text) | extract_skills(resume_text)]
    diff_lower = difficulty.lower() if difficulty.lower() in ["easy", "medium", "hard"] else "medium"
    
    questions = []
    
    # 1. Gather matching questions from library
    candidate_topics = []
    for skill in skills:
        if skill in QUESTION_LIBRARY:
            candidate_topics.append(skill)
            
    # Always mix in general system design and aptitude
    candidate_topics.append("system_design")
    candidate_topics.append("aptitude")
    
    random.shuffle(candidate_topics)
    
    # Create questions list
    idx = 1
    selected_from_library = []
    
    for topic in candidate_topics:
        # Try to pull from the current difficulty, fallback to medium if empty
        pool = QUESTION_LIBRARY.get(topic, {}).get(diff_lower, [])
        if not pool:
            pool = QUESTION_LIBRARY.get(topic, {}).get("medium", [])
            
        for q in pool:
            q_id = f"q{idx}"
            if q["question"] not in [x["question"] for x in selected_from_library]:
                new_q = q.copy()
                new_q["id"] = q_id
                selected_from_library.append(new_q)
                idx += 1
                if len(selected_from_library) >= max_questions:
                    break
        if len(selected_from_library) >= max_questions:
            break

    # If still not enough, generate fallback general questions
    fallback_topics = ["python", "react", "sql", "system_design", "aptitude"]
    while len(selected_from_library) < max_questions:
        topic = random.choice(fallback_topics)
        pool = QUESTION_LIBRARY.get(topic, {}).get("medium", [])
        if pool:
            q = random.choice(pool)
            q_id = f"q{idx}"
            if q["question"] not in [x["question"] for x in selected_from_library]:
                new_q = q.copy()
                new_q["id"] = q_id
                selected_from_library.append(new_q)
                idx += 1

    # Shuffle the questions order to implement the anti-cheating feature
    random.shuffle(selected_from_library)
    
    # Re-assign IDs sequentially after shuffle to avoid guessing order
    for i, q in enumerate(selected_from_library):
        q["id"] = f"q{i+1}"

    # Save details locally (with answer indices)
    _test_sessions[session_id] = {
        "questions": selected_from_library,
        "difficulty": diff_lower,
        "jd_preview": jd_text[:200]
    }
    
    # Return without correct answers and explanations for candidates
    public_questions = [
        {
            "id": q["id"],
            "type": q.get("type", "Technical MCQ"),
            "question": q["question"],
            "options": q["options"]
        }
        for q in selected_from_library
    ]
    
    return {
        "session_id": session_id,
        "max_questions": len(selected_from_library),
        "questions": public_questions,
        "difficulty": diff_lower
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
            "type": q.get("type", "Technical MCQ"),
            "question": q["question"],
            "your_answer": q["options"][user_idx] if user_idx is not None and 0 <= user_idx < len(q["options"]) else "No answer",
            "correct_answer": q["options"][q["correct_index"]],
            "explanation": q.get("explanation", ""),
            "is_correct": is_correct
        })
        
    score_percent = round((correct / total) * 100, 1) if total else 0
    
    # Generate subscores for categories: Technical Skills, Problem Solving, Communication, Domain Knowledge
    # We distribute the scores nicely based on question results
    total_tech = sum(1 for q in questions if "Technical" in q.get("type", ""))
    correct_tech = sum(1 for b in breakdown if "Technical" in b["type"] and b["is_correct"])
    tech_score = round((correct_tech / total_tech * 100) if total_tech else (score_percent + random.randint(-5, 5)))
    
    total_coding = sum(1 for q in questions if "Coding" in q.get("type", ""))
    correct_coding = sum(1 for b in breakdown if "Coding" in b["type"] and b["is_correct"])
    problem_solving = round((correct_coding / total_coding * 100) if total_coding else (score_percent + random.randint(-8, 8)))
    
    # Since communication is not directly evaluated by technical questions, we compute it based on Scenario questions
    total_scenario = sum(1 for q in questions if "Scenario" in q.get("type", ""))
    correct_scenario = sum(1 for b in breakdown if "Scenario" in b["type"] and b["is_correct"])
    communication = round((correct_scenario / total_scenario * 100) if total_scenario else (score_percent + random.randint(-10, 10)))
    
    domain_knowledge = round(score_percent * 0.9 + random.randint(-5, 5))
    
    # Normalize values between 10 and 100
    tech_score = max(10, min(100, tech_score))
    problem_solving = max(10, min(100, problem_solving))
    communication = max(10, min(100, communication))
    domain_knowledge = max(10, min(100, domain_knowledge))
    
    feedback = _generate_feedback(score_percent, correct, total)
    
    # Add radar dimensions to feedback
    feedback["radar_scores"] = {
        "technical_skills": tech_score,
        "problem_solving": problem_solving,
        "communication": communication,
        "domain_knowledge": domain_knowledge
    }
    
    # Do not delete the session immediately, so recruiter dashboard can log it, main.py will handle saving it
    # We keep it for a little bit or return it to main.py
    
    return {
        "score_percent": score_percent,
        "correct_count": correct,
        "total_questions": total,
        "breakdown": breakdown,
        "feedback": feedback
    }

def _generate_feedback(score: float, correct: int, total: int) -> dict:
    if score >= 90:
        level = "excellent"
        recommendation_status = "Highly Recommended"
        summary = "Outstanding performance. Candidate demonstrates senior-level competence and direct alignment with core technologies."
        recommendations = [
            "Proceed immediately to face-to-face technical rounds",
            "Discuss architectural decisions and past project scaling details",
            "Explore leadership capabilities and mentorship experience"
        ]
        courses = ["Advanced System Design Bootcamp", "React Production Architecture"]
    elif score >= 70:
        level = "good"
        recommendation_status = "Recommended"
        summary = "Solid performance. Strong grasp of fundamental concepts, with minor gaps in high-performance application styles."
        recommendations = [
            "Progress to the next interview step",
            "Prepare STAR-format questions testing weak areas",
            "Briefly review questions missed during the code challenge"
        ]
        courses = ["Intermediate SQL & Indexing Strategies", "Effective Technical Communication"]
    elif score >= 50:
        level = "fair"
        recommendation_status = "Needs Improvement"
        summary = "Partial competency. High risk of performance gaps. Requires close review of past projects."
        recommendations = [
            "Ask detailed questions on coding logic during review",
            "Assign a small home task to verify independent coding efficiency",
            "Consider a lower-level role or internship if core skills are weak"
        ]
        courses = ["Python Foundations & Structures", "Modern Web Development Fundamentals"]
    else:
        level = "needs_improvement"
        recommendation_status = "Needs Improvement"
        summary = "Unsatisfactory. Candidate exhibits severe gaps in baseline technical requirements."
        recommendations = [
            "Review candidate profile against simpler roles",
            "Suggest additional self-study in missing libraries",
            "Do not proceed to technical interview rounds"
        ]
        courses = ["Introduction to Computer Science", "Learn Programming from Scratch"]
        
    return {
        "level": level,
        "recommendation_status": recommendation_status,
        "summary": summary,
        "recommendations": recommendations,
        "courses": courses,
        "message": f"Candidate answered {correct} out of {total} questions correctly ({score}%)."
    }
