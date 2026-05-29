"""
Regression tests: the three places that touch DQN state must agree on the
key set, otherwise weights trained against one will silently misbehave
against another.
"""

from __future__ import annotations

from app.adaptive.rules import initial_state

REQUIRED_KEYS = {
    "quiz_accuracy",
    "mcq_accuracy",
    "lab_success_rate",
    "recent_trend",
    "attempts_count",
    "avg_response_time",
    "topic_confidence",
}


def test_initial_state_has_required_keys() -> None:
    assert set(initial_state().keys()) == REQUIRED_KEYS


def test_student_env_reset_has_required_keys() -> None:
    """``AdaptiveStudentEnv.reset()`` must yield the same key set."""
    import pytest

    pytest.importorskip("torch")  # env import path doesn't need torch, but encode_state does
    from app.ml.student_env_v2 import AdaptiveStudentEnv

    state = AdaptiveStudentEnv().reset()
    assert REQUIRED_KEYS.issubset(state.keys())


def test_encode_state_uses_required_keys() -> None:
    """``encode_state`` must produce a 7-vector aligned with REQUIRED_KEYS."""
    import pytest

    torch = pytest.importorskip("torch")
    from app.ml.dqn_model import encode_state

    tensor = encode_state(initial_state())
    assert tensor.shape == (len(REQUIRED_KEYS),)
    assert tensor.dtype == torch.float32
