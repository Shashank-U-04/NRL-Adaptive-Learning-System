"""
NRL Adaptive Learning System — Module Service

Provides static learning module content for database seeding.
AI-based generation has been moved to ai_generation_service.py;
this module handles deterministic, offline-safe content only.
"""


def _static_blocks(topic_id: str) -> list[dict]:
    """Build the content blocks for a given topic slug."""
    friendly = topic_id.replace("-", " ").title()
    return [
        {
            "type": "text",
            "content": (
                f"Welcome to the {friendly} module. "
                f"This topic covers core security concepts and practical defenses you can apply today."
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
    ]


def build_static_module(topic_id: str, topic_name: str) -> dict:
    """
    Build a static learning module dict for a topic.

    Called by seed.py to populate the learning_modules table without
    requiring AI generation or network access.

    Args:
        topic_id:   URL-safe slug (e.g. "web-security").
        topic_name: Human-readable title (e.g. "Web Security").

    Returns:
        A module content dict ready for insertion into LearningModule.content.
    """
    return {
        "topic_id": topic_id,
        "title": f"Introduction to {topic_name}",
        "difficulty": 1,
        "estimatedMinutes": 10,
        "content": _static_blocks(topic_id),
    }
