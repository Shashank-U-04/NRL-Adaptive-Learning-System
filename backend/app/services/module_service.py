"""
NRL Adaptive Learning System — Module Service

Provides static learning module content for database seeding.
All content is deterministic and offline-safe — no AI generation or network access.
"""


def build_static_module(topic_id: str, topic_name: str) -> dict:
    """
    Build a static learning module dict for a topic.

    Called by seed.py to populate the learning_modules table without
    requiring AI generation or network access.

    Args:
        topic_id:   URL-safe slug (e.g. "web-security").
        topic_name: Human-readable title (e.g. "Web Security").

    Returns:
        A module content dict in the canonical API shape expected by the frontend.
    """
    friendly = topic_id.replace("-", " ").title()
    return {
        "id": topic_id,
        "topic_id": topic_id,
        "title": f"Introduction to {topic_name}",
        "description": f"Core concepts and practical defenses for {topic_name}.",
        "difficulty": "beginner",
        "estimated_minutes": 10,
        "lessons": [
            {
                "id": f"{topic_id}-lesson-1",
                "title": f"Foundations of {friendly}",
                "content": (
                    f"Welcome to the {friendly} module. "
                    "This topic covers core security concepts and practical defenses you can apply today."
                ),
                "checkpoints": [],
                "visuals": [],
            }
        ],
        "labs": [
            {
                "id": f"{topic_id}-lab-1",
                "title": "Spot the Issue",
                "description": "Submit the keyword 'sanitize' to acknowledge that user input must always be sanitized.",
                "instructions": [
                    "Read through the scenario below.",
                    "Type the keyword 'sanitize' in the answer box to complete the lab.",
                ],
                "expectedOutcome": "sanitize",
            }
        ],
        "quizPool": [
            {
                "id": f"{topic_id}-mcq-1",
                "type": "mcq",
                "question": f"Which is the most important first step when securing {friendly}?",
                "options": [
                    "Apply least privilege and validate all inputs",
                    "Disable logging to improve performance",
                    "Trust internal network traffic by default",
                    "Embed credentials in client-side code",
                ],
                "answer": "Apply least privilege and validate all inputs",
                "explanation": "Least privilege and input validation are foundational across all security domains.",
                "difficulty": 0.3,
            }
        ],
        # Keep raw content blocks for lab validation in the /learning/lab submission endpoint
        "content": [
            {
                "type": "text",
                "content": (
                    f"Welcome to the {friendly} module. "
                    "This topic covers core security concepts and practical defenses you can apply today."
                ),
            },
            {
                "type": "mcq_inline",
                "id": "mcq_1",
                "question": f"Which is the most important first step when securing {friendly}?",
                "options": [
                    "Apply least privilege and validate all inputs",
                    "Disable logging to improve performance",
                    "Trust internal network traffic by default",
                    "Embed credentials in client-side code",
                ],
                "correctIndex": 0,
                "explanation": "Least privilege and input validation are foundational across all security domains.",
            },
            {
                "type": "lab",
                "title": "Spot the issue",
                "description": "Submit the keyword 'sanitize' to acknowledge that user input must always be sanitized.",
                "validation": {"rule_type": "contains", "pattern": "sanitize"},
                "successMessage": "Correct — never trust user input without validation.",
            },
            {
                "type": "summary",
                "content": (
                    f"You learned the basics of {friendly}: validate inputs, apply least privilege, "
                    "and monitor for anomalies. Practice quizzes will reinforce these patterns."
                ),
            },
        ],
    }
