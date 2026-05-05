"""
DQN agent integration tests.

These tests are skipped if PyTorch isn't available or no trained checkpoint
exists, so the suite still passes on hosts without the ML stack.
"""

from __future__ import annotations

from pathlib import Path

import pytest

torch = pytest.importorskip("torch")  # noqa: F841 (skip whole module if torch missing)

from backend.app.core.config import RL_MODEL_PATH
from backend.app.ml.dqn_model import DQN, encode_state
from backend.app.ml.student_env_v2 import ACTIONS, AdaptiveStudentEnv
from backend.app.services.rl_service import ACTIONS as RL_ACTIONS
from backend.app.services.rl_service import RLService


def _has_trained_weights() -> bool:
    return Path(RL_MODEL_PATH).exists()


def test_action_space_alignment():
    """Env actions and rl_service actions must match exactly."""
    assert ACTIONS == RL_ACTIONS


def test_encode_state_shape():
    state = AdaptiveStudentEnv().reset()
    tensor = encode_state(state)
    assert tensor.shape == (7,)
    assert tensor.dtype == torch.float32


def test_env_step_produces_valid_observation():
    env = AdaptiveStudentEnv(seed=0)
    state = env.reset()
    next_state, reward, done, info = env.step(0)  # Easy question
    assert {
        "quiz_accuracy", "mcq_accuracy", "lab_success_rate",
        "recent_trend", "attempts_count", "avg_response_time", "topic_confidence",
    }.issubset(next_state.keys())
    assert isinstance(reward, float)
    assert isinstance(done, bool)
    assert "action" in info


def test_env_episode_terminates():
    """An episode must terminate within MAX_STEPS."""
    env = AdaptiveStudentEnv(seed=1)
    env.reset()
    steps = 0
    done = False
    while not done and steps < AdaptiveStudentEnv.MAX_STEPS + 5:
        _, _, done, _ = env.step(steps % 7)
        steps += 1
    assert done
    assert steps <= AdaptiveStudentEnv.MAX_STEPS + 1


@pytest.mark.skipif(not _has_trained_weights(), reason="No trained DQN weights present")
def test_rl_service_loads_trained_dqn():
    """When weights exist, RLService should report has_model=True."""
    # Force a fresh service instance — global singleton may have been built before training
    rl = RLService()
    assert rl.has_model, "RLService failed to load DQN weights from RL_MODEL_PATH"


@pytest.mark.skipif(not _has_trained_weights(), reason="No trained DQN weights present")
def test_dqn_recommends_easy_for_struggling_learner():
    """A struggling-declining learner should be steered to easier work or hints."""
    rl = RLService()
    if not rl.has_model:
        pytest.skip("Weights present but failed to load")

    state = {
        "quiz_accuracy": 0.2,
        "mcq_accuracy": 0.2,
        "lab_success_rate": 0.3,
        "recent_trend": "declining",
        "attempts_count": 8,
        "avg_response_time": 18.0,
        "topic_confidence": 0.25,
    }
    action, confidence, _explanation = rl.recommend_action(state)
    # Safety rule should trigger here, but even if DQN runs it must not push to Hard / Advance
    assert action not in {"Present_Hard_Question", "Move_To_Next_Topic"}
    assert 0.0 <= confidence <= 1.0


@pytest.mark.skipif(not _has_trained_weights(), reason="No trained DQN weights present")
def test_dqn_advances_on_mastery():
    """A learner with very high accuracy and confidence should advance topics."""
    rl = RLService()
    if not rl.has_model:
        pytest.skip("Weights present but failed to load")

    state = {
        "quiz_accuracy": 0.95,
        "mcq_accuracy": 0.95,
        "lab_success_rate": 0.9,
        "recent_trend": "improving",
        "attempts_count": 15,
        "avg_response_time": 6.0,
        "topic_confidence": 0.9,
    }
    action, _confidence, _explanation = rl.recommend_action(state)
    # Either the safety rule or the DQN should pick an advancing action
    assert action in {"Move_To_Next_Topic", "Present_Hard_Question"}
