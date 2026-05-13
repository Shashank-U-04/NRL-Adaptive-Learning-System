"""
Adaptive engine unit tests.

Pure unit tests — no HTTP, no DB, no fixtures required.
Tests cover: safety rules, heuristic fallback, reward calculation,
initial state shape, and EMA state update logic.
"""

from __future__ import annotations

import pytest

from app.adaptive.rules import (
    ACTIONS,
    ACTION_INDICES,
    apply_safety_rules,
    heuristic_fallback,
    calculate_reward,
    initial_state,
)
from app.adaptive.engine import AdaptiveEngine
from app.services.session_service import SessionService


# ── Helpers ──────────────────────────────────────────────────────────────────

def _state(
    quiz_accuracy: float = 0.5,
    lab_success_rate: float = 0.5,
    recent_trend: str = "stable",
    topic_confidence: float = 0.5,
    attempts_count: int = 5,
    avg_response_time: float = 10.0,
    mcq_accuracy: float = 0.5,
) -> dict:
    """Build a minimal valid state dict for testing."""
    return {
        "quiz_accuracy": quiz_accuracy,
        "mcq_accuracy": mcq_accuracy,
        "lab_success_rate": lab_success_rate,
        "recent_trend": recent_trend,
        "attempts_count": attempts_count,
        "avg_response_time": avg_response_time,
        "topic_confidence": topic_confidence,
    }


# ── Safety rule tests ─────────────────────────────────────────────────────────

def test_safety_rule_declining_accuracy_forces_easy():
    """
    Arrange: state with declining trend and sub-40% accuracy
    Act: apply_safety_rules
    Assert: action is Present_Easy_Question
    """
    # Arrange
    state = _state(quiz_accuracy=0.3, recent_trend="declining")

    # Act
    action_idx, reason = apply_safety_rules(state)

    # Assert
    assert action_idx is not None, "Safety rule should have fired"
    assert ACTIONS[action_idx] == "Present_Easy_Question"
    assert reason != ""


def test_safety_rule_high_accuracy_advances_topic():
    """
    Arrange: state with >90% accuracy and >85% topic confidence
    Act: apply_safety_rules
    Assert: action is Move_To_Next_Topic
    """
    # Arrange
    state = _state(quiz_accuracy=0.95, topic_confidence=0.90)

    # Act
    action_idx, reason = apply_safety_rules(state)

    # Assert
    assert action_idx is not None, "Safety rule should have fired"
    assert ACTIONS[action_idx] == "Move_To_Next_Topic"
    assert reason != ""


def test_safety_rule_neutral_state_returns_none():
    """
    Arrange: mid-range state where no safety rule should trigger
    Act: apply_safety_rules
    Assert: (None, "") — no override
    """
    # Arrange
    state = _state(quiz_accuracy=0.6, recent_trend="stable", topic_confidence=0.6)

    # Act
    action_idx, reason = apply_safety_rules(state)

    # Assert
    assert action_idx is None
    assert reason == ""


# ── Heuristic fallback tests ──────────────────────────────────────────────────

def test_heuristic_low_accuracy_returns_easy():
    """
    Arrange: quiz_accuracy below 0.4
    Act: heuristic_fallback
    Assert: returns Present_Easy_Question
    """
    # Arrange
    state = _state(quiz_accuracy=0.25, lab_success_rate=0.3)

    # Act
    action_idx, reason = heuristic_fallback(state)

    # Assert
    assert ACTIONS[action_idx] == "Present_Easy_Question"
    assert reason != ""


def test_heuristic_high_accuracy_returns_hard():
    """
    Arrange: quiz_accuracy >= 0.75
    Act: heuristic_fallback
    Assert: returns Present_Hard_Question
    """
    # Arrange
    state = _state(quiz_accuracy=0.85, lab_success_rate=0.8)

    # Act
    action_idx, reason = heuristic_fallback(state)

    # Assert
    assert ACTIONS[action_idx] == "Present_Hard_Question"
    assert reason != ""


def test_heuristic_medium_accuracy_low_lab_gives_hint():
    """
    Arrange: moderate accuracy (0.4 <= qa < 0.75) but struggling with labs
    Act: heuristic_fallback
    Assert: returns Give_Hint
    """
    # Arrange
    state = _state(quiz_accuracy=0.55, lab_success_rate=0.3)

    # Act
    action_idx, reason = heuristic_fallback(state)

    # Assert
    assert ACTIONS[action_idx] == "Give_Hint"


def test_heuristic_medium_accuracy_ok_lab_returns_medium():
    """
    Arrange: moderate accuracy (0.4 <= qa < 0.75) and acceptable lab rate
    Act: heuristic_fallback
    Assert: returns Present_Medium_Question
    """
    # Arrange
    state = _state(quiz_accuracy=0.60, lab_success_rate=0.65)

    # Act
    action_idx, reason = heuristic_fallback(state)

    # Assert
    assert ACTIONS[action_idx] == "Present_Medium_Question"


# ── Reward function tests ─────────────────────────────────────────────────────

def test_reward_correct_answer():
    """
    Arrange: correct answer, no other flags
    Act: calculate_reward
    Assert: positive float (>= 1.0)
    """
    # Act
    reward = calculate_reward(is_correct=True, is_improvement=False, is_repeated_mistake=False)

    # Assert
    assert reward > 0.0
    assert reward >= 1.0


def test_reward_wrong_answer_is_zero():
    """
    Arrange: wrong answer with no special flags
    Act: calculate_reward
    Assert: reward == 0.0 (no penalties without repeated_mistake flag)
    """
    # Act
    reward = calculate_reward(is_correct=False, is_improvement=False, is_repeated_mistake=False)

    # Assert
    assert reward == 0.0


def test_reward_repeated_mistake_penalty():
    """
    Arrange: wrong answer that is a repeated mistake
    Act: calculate_reward
    Assert: reward is more negative than a plain wrong answer (< 0.0)
    """
    # Arrange
    plain_wrong = calculate_reward(is_correct=False, is_improvement=False, is_repeated_mistake=False)

    # Act
    repeated_wrong = calculate_reward(is_correct=False, is_improvement=False, is_repeated_mistake=True)

    # Assert
    assert repeated_wrong < plain_wrong, (
        f"Repeated mistake ({repeated_wrong}) should be worse than plain wrong ({plain_wrong})"
    )
    assert repeated_wrong < 0.0


def test_reward_improvement_bonus():
    """
    Arrange: correct answer with improvement flag
    Act: calculate_reward
    Assert: reward > plain correct reward
    """
    # Arrange
    plain_correct = calculate_reward(is_correct=True, is_improvement=False)

    # Act
    improved_correct = calculate_reward(is_correct=True, is_improvement=True)

    # Assert
    assert improved_correct > plain_correct


def test_reward_lab_success_bonus():
    """
    Arrange: correct answer with lab_success flag
    Act: calculate_reward
    Assert: reward > plain correct reward
    """
    # Arrange
    plain_correct = calculate_reward(is_correct=True)

    # Act
    lab_correct = calculate_reward(is_correct=True, lab_success=True)

    # Assert
    assert lab_correct > plain_correct


# ── Initial state tests ───────────────────────────────────────────────────────

def test_initial_state_is_neutral():
    """
    Arrange: no prior state
    Act: initial_state()
    Assert: returns dict with 7 expected keys at neutral/mid values
    """
    # Act
    state = initial_state()

    # Assert — shape
    expected_keys = {
        "quiz_accuracy",
        "mcq_accuracy",
        "lab_success_rate",
        "recent_trend",
        "attempts_count",
        "avg_response_time",
        "topic_confidence",
    }
    assert set(state.keys()) == expected_keys

    # Assert — neutral numeric values
    assert state["quiz_accuracy"] == pytest.approx(0.5)
    assert state["mcq_accuracy"] == pytest.approx(0.5)
    assert state["lab_success_rate"] == pytest.approx(0.5)
    assert state["topic_confidence"] == pytest.approx(0.5)
    assert state["attempts_count"] == 0
    assert state["recent_trend"] == "stable"
    assert state["avg_response_time"] > 0.0


def test_initial_state_returns_new_dict_each_call():
    """
    Arrange: call initial_state twice
    Assert: the two dicts are independent (mutation of one does not affect the other)
    """
    # Act
    s1 = initial_state()
    s2 = initial_state()

    # Mutate s1
    s1["quiz_accuracy"] = 0.99

    # Assert s2 is unaffected
    assert s2["quiz_accuracy"] == pytest.approx(0.5)


# ── EMA / state update tests ──────────────────────────────────────────────────

def test_state_update_ema_smoothing_correct_answer():
    """
    Arrange: neutral initial state
    Act: simulate one correct answer via SessionService._update_state
    Assert: quiz_accuracy moves smoothly toward 1.0 (not a hard jump)
    """
    # Arrange — use a dummy SessionService (no db needed for this pure method)
    # We instantiate with None db because _update_state is a sync helper
    class _FakeDb:
        pass

    service = SessionService.__new__(SessionService)  # bypass __init__
    state = initial_state()
    alpha = 0.2
    expected_new_qa = round(state["quiz_accuracy"] * (1 - alpha) + 1.0 * alpha, 4)

    # Act
    new_state = service._update_state(state, is_correct=True, time_taken=8)

    # Assert — EMA, not a hard jump
    assert new_state["quiz_accuracy"] == pytest.approx(expected_new_qa)
    assert new_state["quiz_accuracy"] > state["quiz_accuracy"]
    assert new_state["quiz_accuracy"] < 1.0  # smooth, not an instant 100%
    assert new_state["attempts_count"] == state["attempts_count"] + 1


def test_state_update_ema_smoothing_wrong_answer():
    """
    Arrange: neutral initial state
    Act: simulate one wrong answer
    Assert: quiz_accuracy decreases smoothly (not a hard drop to 0)
    """
    # Arrange
    service = SessionService.__new__(SessionService)
    state = initial_state()
    alpha = 0.2
    expected_new_qa = round(state["quiz_accuracy"] * (1 - alpha) + 0.0 * alpha, 4)

    # Act
    new_state = service._update_state(state, is_correct=False, time_taken=15)

    # Assert
    assert new_state["quiz_accuracy"] == pytest.approx(expected_new_qa)
    assert new_state["quiz_accuracy"] < state["quiz_accuracy"]
    assert new_state["quiz_accuracy"] > 0.0  # smooth, not 0


def test_state_update_trend_improving():
    """
    Arrange: start from a state with below-average accuracy
    Act: answer correctly enough times that new accuracy rises > old + 0.02
    Assert: recent_trend is "improving"
    """
    # Arrange
    service = SessionService.__new__(SessionService)
    # Artificially low accuracy so one correct answer causes > 0.02 jump
    state = _state(quiz_accuracy=0.1, attempts_count=0)

    # Act
    new_state = service._update_state(state, is_correct=True, time_taken=5)

    # Assert: 0.1 * 0.8 + 1.0 * 0.2 = 0.28 → delta = 0.18 > 0.02
    assert new_state["recent_trend"] == "improving"


def test_state_update_trend_declining():
    """
    Arrange: start from high accuracy
    Act: answer incorrectly
    Assert: recent_trend is "declining" (delta > 0.02 drop)
    """
    # Arrange
    service = SessionService.__new__(SessionService)
    state = _state(quiz_accuracy=0.9, attempts_count=0)

    # Act
    new_state = service._update_state(state, is_correct=False, time_taken=5)

    # Assert: 0.9 * 0.8 + 0.0 * 0.2 = 0.72 → delta = -0.18, drop > 0.02
    assert new_state["recent_trend"] == "declining"


# ── AdaptiveEngine integration tests (no DB/HTTP) ─────────────────────────────

def test_engine_recommend_action_returns_valid_action():
    """
    Arrange: AdaptiveEngine instance (no torch model in test env)
    Act: recommend_action with a neutral state
    Assert: action_name is one of the known ACTIONS values
    """
    # Arrange
    engine = AdaptiveEngine()
    state = initial_state()

    # Act
    action_name, confidence, explanation = engine.recommend_action(state)

    # Assert
    assert action_name in ACTIONS.values(), f"Unknown action: {action_name}"
    assert 0.0 <= confidence <= 1.0
    assert isinstance(explanation, str) and len(explanation) > 0


def test_engine_recommend_action_safety_override():
    """
    Arrange: state that triggers the safety rule (declining + low accuracy)
    Act: recommend_action
    Assert: action is Present_Easy_Question regardless of DQN availability
    """
    # Arrange
    engine = AdaptiveEngine()
    dangerous_state = _state(quiz_accuracy=0.2, recent_trend="declining")

    # Act
    action_name, confidence, explanation = engine.recommend_action(dangerous_state)

    # Assert
    assert action_name == "Present_Easy_Question"
    assert "[Safety Rule]" in explanation
    assert confidence == pytest.approx(0.95)


def test_engine_calculate_reward_delegates_correctly():
    """
    Arrange: AdaptiveEngine
    Act: calculate_reward via engine static method
    Assert: result matches direct call to rules.calculate_reward
    """
    # Arrange
    engine = AdaptiveEngine()

    # Act
    via_engine = engine.calculate_reward(
        is_correct=True, is_improvement=True, is_repeated_mistake=False, lab_success=False
    )
    direct = calculate_reward(
        is_correct=True, is_improvement=True, is_repeated_mistake=False, lab_success=False
    )

    # Assert
    assert via_engine == pytest.approx(direct)


def test_engine_initial_state_matches_rules_initial_state():
    """
    Arrange: AdaptiveEngine
    Act: initial_state via engine static method
    Assert: result matches direct call to rules.initial_state
    """
    # Arrange
    engine = AdaptiveEngine()

    # Act
    via_engine = engine.initial_state()
    direct = initial_state()

    # Assert
    assert via_engine == direct
