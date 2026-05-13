"""
NRL Adaptive Learning System — Adaptive Rules

Pure functions: no classes, no torch import.
Used by AdaptiveEngine for deterministic safety rules,
heuristic fallback, reward calculation, and state initialisation.
"""

# ── Action Space ──────────────────────────────────────────
ACTIONS: dict[int, str] = {
    0: "Present_Easy_Question",
    1: "Present_Medium_Question",
    2: "Present_Hard_Question",
    3: "Give_Hint",
    4: "Review_Previous_Topic",
    5: "Move_To_Next_Topic",
    6: "End_Session",
}

ACTION_INDICES: dict[str, int] = {v: k for k, v in ACTIONS.items()}


# ── Safety rules ──────────────────────────────────────────

def apply_safety_rules(state: dict) -> tuple[int | None, str]:
    """
    Check deterministic safety conditions.

    Returns (action_index, reason) if a rule fires, or (None, "") otherwise.
    Safety rules always take priority over DQN / heuristic decisions.
    """
    qa = state.get("quiz_accuracy", 0.5)
    trend = state.get("recent_trend", "stable")
    tc = state.get("topic_confidence", 0.5)

    if trend == "declining" and qa < 0.4:
        return (
            ACTION_INDICES["Present_Easy_Question"],
            "Performance declining with <40% accuracy — resetting to Easy to rebuild confidence",
        )
    if qa > 0.9 and tc > 0.85:
        return (
            ACTION_INDICES["Move_To_Next_Topic"],
            "Accuracy >90% and high confidence — advancing to next topic",
        )
    return None, ""


# ── Heuristic fallback ────────────────────────────────────

def heuristic_fallback(state: dict) -> tuple[int, str]:
    """
    Rule-based action selection used when the DQN model is unavailable.

    Returns (action_index, reason).
    """
    qa = state.get("quiz_accuracy", 0.5)
    ls = state.get("lab_success_rate", 0.5)

    if qa < 0.4:
        return ACTION_INDICES["Present_Easy_Question"], "Low accuracy — starting with Easy"
    if qa < 0.75:
        if ls < 0.5:
            return ACTION_INDICES["Give_Hint"], "Struggling with labs — providing a hint"
        return ACTION_INDICES["Present_Medium_Question"], "Moderate accuracy — Medium difficulty"
    return ACTION_INDICES["Present_Hard_Question"], "High accuracy — challenging with Hard"


# ── Reward function ───────────────────────────────────────

def calculate_reward(
    is_correct: bool,
    is_improvement: bool = False,
    is_repeated_mistake: bool = False,
    lab_success: bool = False,
) -> float:
    """
    Deterministic reward function per architecture plan:
      +1.0  correct answer
      +0.5  improvement trend
      -0.5  repeated mistake
      +0.7  lab success
    """
    reward = 0.0
    if is_correct:
        reward += 1.0
    if is_improvement:
        reward += 0.5
    if is_repeated_mistake:
        reward -= 0.5
    if lab_success:
        reward += 0.7
    return reward


# ── Initial state ─────────────────────────────────────────

def initial_state() -> dict:
    """Return the neutral cold-start learner state (7 float-compatible fields)."""
    return {
        "quiz_accuracy": 0.5,
        "mcq_accuracy": 0.5,
        "lab_success_rate": 0.5,
        "recent_trend": "stable",
        "attempts_count": 0,
        "avg_response_time": 10.0,
        "topic_confidence": 0.5,
    }
