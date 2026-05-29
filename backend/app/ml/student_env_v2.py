"""
NRL Adaptive Learning System — Simulated Learner Environment v2

``AdaptiveStudentEnv`` is the training environment for the production DQN
defined in ``app.ml.dqn_model``. The state dict matches
``app.ml.dqn_model.encode_state`` exactly so weights trained here can be
loaded by ``app.adaptive.engine`` at runtime without any reshape.

State schema (7 features):
    quiz_accuracy:     float in [0.0, 1.0]
    mcq_accuracy:      float in [0.0, 1.0]
    lab_success_rate:  float in [0.0, 1.0]
    recent_trend:      "declining" | "stable" | "improving"
    attempts_count:    int
    avg_response_time: float seconds
    topic_confidence:  float in [0.0, 1.0]

Action space matches ``app.adaptive.rules.ACTIONS`` exactly.
"""

from __future__ import annotations

import random
from typing import Any

from app.adaptive.rules import ACTIONS

# Re-export so callers and tests can import ACTIONS from this module.
__all__ = ["ACTIONS", "AdaptiveStudentEnv"]


# Map question-style action names to a difficulty index (0=easy, 1=medium, 2=hard).
_QUESTION_DIFFICULTY: dict[str, int] = {
    "Present_Easy_Question": 0,
    "Present_Medium_Question": 1,
    "Present_Hard_Question": 2,
}


class AdaptiveStudentEnv:
    """Stochastic single-topic learner simulator for DQN training.

    The simulator models a student whose probability of answering correctly
    depends on their current ``topic_confidence`` and the question difficulty.
    Each step returns ``(next_state, reward, done, info)`` so the training
    loop in ``app.ml.train_dqn`` can drive the agent through episodes.
    """

    MAX_STEPS: int = 30
    _EMA_ALPHA: float = 0.2

    def __init__(self, seed: int | None = None) -> None:
        self._rng = random.Random(seed)
        self._steps = 0
        self._state: dict[str, Any] = self._fresh_state()

    @staticmethod
    def action_space_size() -> int:
        return len(ACTIONS)

    @staticmethod
    def state_size() -> int:
        return 7

    # ── Lifecycle ─────────────────────────────────────────
    def reset(self) -> dict[str, Any]:
        self._steps = 0
        self._state = self._fresh_state()
        return dict(self._state)

    def _fresh_state(self) -> dict[str, Any]:
        return {
            "quiz_accuracy": 0.5,
            "mcq_accuracy": 0.5,
            "lab_success_rate": 0.5,
            "recent_trend": "stable",
            "attempts_count": 0,
            "avg_response_time": 10.0,
            "topic_confidence": 0.4,
        }

    # ── Step ──────────────────────────────────────────────
    def step(
        self, action_idx: int
    ) -> tuple[dict[str, Any], float, bool, dict[str, Any]]:
        if action_idx not in ACTIONS:
            raise ValueError(f"Invalid action index: {action_idx}")

        action_name = ACTIONS[action_idx]
        self._steps += 1
        prev_qa = self._state["quiz_accuracy"]
        info: dict[str, Any] = {"action": action_name}

        if action_name == "End_Session":
            reward = self._end_session_reward()
            done = True
        elif action_name in _QUESTION_DIFFICULTY:
            difficulty = _QUESTION_DIFFICULTY[action_name]
            is_correct, response_time = self._simulate_answer(difficulty)
            self._apply_question(difficulty, is_correct, response_time)
            reward = self._question_reward(difficulty, is_correct, prev_qa)
            info["is_correct"] = is_correct
            done = self._step_limit_reached()
        elif action_name == "Give_Hint":
            reward = self._apply_hint()
            done = self._step_limit_reached()
        elif action_name == "Review_Previous_Topic":
            reward = self._apply_review()
            done = self._step_limit_reached()
        elif action_name == "Move_To_Next_Topic":
            reward = self._apply_advance()
            done = self._step_limit_reached()
        else:
            # Unreachable: ACTIONS validated above.
            reward = -0.5
            done = self._step_limit_reached()

        self._update_trend(prev_qa)
        return dict(self._state), float(reward), done, info

    # ── Action handlers ───────────────────────────────────
    def _simulate_answer(self, difficulty: int) -> tuple[bool, float]:
        tc = self._state["topic_confidence"]
        base = {0: 0.55, 1: 0.40, 2: 0.25}[difficulty]
        prob = base + 0.4 * (tc - 0.5) + self._rng.uniform(-0.05, 0.05)
        prob = max(0.05, min(0.95, prob))
        is_correct = self._rng.random() < prob

        # Response time grows with difficulty and shrinks with confidence.
        rt = 6.0 + 4.0 * difficulty + (1.0 - tc) * 10.0
        rt += self._rng.uniform(-2.0, 2.0)
        return is_correct, max(2.0, rt)

    def _apply_question(self, difficulty: int, is_correct: bool, rt: float) -> None:
        s = self._state
        outcome = 1.0 if is_correct else 0.0
        s["quiz_accuracy"] = self._ema(s["quiz_accuracy"], outcome)
        s["mcq_accuracy"] = self._ema(s["mcq_accuracy"], outcome)
        # Lab proxy drifts toward quiz performance more slowly.
        s["lab_success_rate"] = self._ema(
            s["lab_success_rate"], outcome, alpha=self._EMA_ALPHA / 2
        )
        s["attempts_count"] += 1
        n = s["attempts_count"]
        s["avg_response_time"] = round(
            s["avg_response_time"] + (rt - s["avg_response_time"]) / n, 2
        )
        # Confidence shifts with outcome; harder questions move it more.
        weight = 0.1 + 0.05 * difficulty
        delta = (outcome - 0.5) * weight
        s["topic_confidence"] = max(0.0, min(1.0, s["topic_confidence"] + delta))

    def _question_reward(
        self, difficulty: int, is_correct: bool, prev_qa: float
    ) -> float:
        is_improvement = self._state["quiz_accuracy"] > prev_qa
        is_repeated_mistake = (not is_correct) and prev_qa < 0.4

        reward = 0.0
        if is_correct:
            reward += 1.0
            reward += 0.15 * difficulty
        else:
            # Wrong-on-easy hurts more than wrong-on-hard.
            reward -= 0.5 + 0.15 * (2 - difficulty)
        if is_improvement:
            reward += 0.3
        if is_repeated_mistake:
            reward -= 0.5
        return round(reward, 3)

    def _apply_hint(self) -> float:
        s = self._state
        struggling = s["quiz_accuracy"] < 0.6
        s["topic_confidence"] = min(1.0, s["topic_confidence"] + 0.05)
        return 0.1 if struggling else -0.2

    def _apply_review(self) -> float:
        s = self._state
        if s["topic_confidence"] < 0.7:
            s["topic_confidence"] = min(1.0, s["topic_confidence"] + 0.08)
            return 0.05
        return -0.3

    def _apply_advance(self) -> float:
        s = self._state
        if s["topic_confidence"] >= 0.7 and s["quiz_accuracy"] >= 0.7:
            # Mastery: simulate a fresh topic with mild carry-over decay.
            s["topic_confidence"] = 0.4
            s["quiz_accuracy"] = max(0.5, s["quiz_accuracy"] - 0.2)
            s["recent_trend"] = "stable"
            return 1.0
        return -1.0

    def _end_session_reward(self) -> float:
        s = self._state
        if s["attempts_count"] < 5:
            return -1.0
        if s["quiz_accuracy"] >= 0.7 and s["topic_confidence"] >= 0.6:
            return 1.5
        if s["quiz_accuracy"] >= 0.5:
            return 0.3
        return -0.5

    # ── Helpers ───────────────────────────────────────────
    def _ema(self, old: float, new: float, alpha: float | None = None) -> float:
        a = self._EMA_ALPHA if alpha is None else alpha
        return round(old * (1 - a) + new * a, 4)

    def _update_trend(self, prev_qa: float) -> None:
        delta = self._state["quiz_accuracy"] - prev_qa
        if delta > 0.02:
            self._state["recent_trend"] = "improving"
        elif delta < -0.02:
            self._state["recent_trend"] = "declining"
        else:
            self._state["recent_trend"] = "stable"

    def _step_limit_reached(self) -> bool:
        return self._steps >= self.MAX_STEPS
