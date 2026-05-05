"""Unit tests for the RL recommendation engine (no DB / network needed)."""

import pytest

from app.services.rl_service import RLService, ACTIONS


def test_initial_state_shape():
    s = RLService.initial_state()
    expected_keys = {
        "quiz_accuracy",
        "mcq_accuracy",
        "lab_success_rate",
        "recent_trend",
        "attempts_count",
        "avg_response_time",
        "topic_confidence",
    }
    assert expected_keys.issubset(s.keys())
    assert 0 <= s["quiz_accuracy"] <= 1


def test_safety_rule_low_accuracy_resets_to_easy():
    rl = RLService()
    state = {
        "quiz_accuracy": 0.2,
        "recent_trend": "declining",
        "topic_confidence": 0.3,
        "lab_success_rate": 0.5,
    }
    name, conf, _explanation = rl.recommend_action(state)
    assert name == "Present_Easy_Question"
    assert conf >= 0.9


def test_safety_rule_high_mastery_advances():
    rl = RLService()
    state = {
        "quiz_accuracy": 0.95,
        "recent_trend": "improving",
        "topic_confidence": 0.9,
        "lab_success_rate": 0.9,
    }
    name, _conf, _ex = rl.recommend_action(state)
    assert name == "Move_To_Next_Topic"


def test_calculate_reward_signs():
    assert RLService.calculate_reward(is_correct=True) == 1.0
    assert RLService.calculate_reward(is_correct=False) == 0.0
    assert (
        RLService.calculate_reward(is_correct=True, is_improvement=True, lab_success=True)
        == pytest.approx(2.2)
    )
    assert (
        RLService.calculate_reward(is_correct=False, is_repeated_mistake=True)
        == pytest.approx(-0.5)
    )


def test_action_space_complete():
    expected = {
        "Present_Easy_Question",
        "Present_Medium_Question",
        "Present_Hard_Question",
        "Give_Hint",
        "Review_Previous_Topic",
        "Move_To_Next_Topic",
        "End_Session",
    }
    assert set(ACTIONS.values()) == expected
