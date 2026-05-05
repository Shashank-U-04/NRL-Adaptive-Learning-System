"""
NRL Adaptive Learning System — DQN Training Environment

Simulates a cybersecurity learner traversing an adaptive quiz session.
State vector matches the 7-feature dict consumed by production rl_service:

    quiz_accuracy, mcq_accuracy, lab_success_rate, recent_trend,
    attempts_count, avg_response_time, topic_confidence

Reward signature matches RLService.calculate_reward():
    +1.0  correct answer
    +0.5  improvement (accuracy trending up)
    -0.5  repeated mistake while already struggling
    +0.7  lab success
    + smaller shaping rewards to guide exploration

Action space matches rl_service.ACTIONS (7 actions).

Usage in train loop:
    env = AdaptiveStudentEnv()
    state = env.reset()
    next_state, reward, done, info = env.step(action_idx)
"""

from __future__ import annotations

import math
import random
from typing import Any

import numpy as np

# Action indices align exactly with rl_service.ACTIONS
ACTIONS = {
    0: "Present_Easy_Question",
    1: "Present_Medium_Question",
    2: "Present_Hard_Question",
    3: "Give_Hint",
    4: "Review_Previous_Topic",
    5: "Move_To_Next_Topic",
    6: "End_Session",
}

# Difficulty levels mapped to numeric values for the simulator
DIFFICULTY_VALUE = {0: 0.25, 1: 0.55, 2: 0.85}  # easy, medium, hard


class AdaptiveStudentEnv:
    """
    Simulates a learner whose latent skill, engagement, and fatigue drive
    response correctness, accuracy trend, and confidence over time.
    The agent observes only the 7-feature dict — never the latent state.
    """

    MAX_STEPS = 30

    def __init__(self, seed: int | None = None) -> None:
        self.rng = random.Random(seed)
        self.np_rng = np.random.default_rng(seed)
        self.reset()

    # ── Episode lifecycle ─────────────────────────────────────

    def reset(self) -> dict[str, Any]:
        # Latent (hidden) student state
        self._true_skill = self.rng.uniform(0.15, 0.65)        # 0..1
        self._engagement = self.rng.uniform(0.55, 0.85)        # 0..1
        self._fatigue = 0.0
        self._hint_buff = 0.0                                  # short-term boost from a hint

        # Public observed state
        self._quiz_history: list[bool] = []
        self._lab_history: list[bool] = []
        self._response_times: list[float] = []
        self._steps = 0
        self._consecutive_wrong = 0
        self._last_action: int | None = None

        self.state = {
            "quiz_accuracy": 0.5,
            "mcq_accuracy": 0.5,
            "lab_success_rate": 0.5,
            "recent_trend": "stable",
            "attempts_count": 0,
            "avg_response_time": 10.0,
            "topic_confidence": 0.5,
        }
        return dict(self.state)

    def step(self, action: int) -> tuple[dict[str, Any], float, bool, dict]:
        if action not in ACTIONS:
            raise ValueError(f"Invalid action {action}")

        prev_qa = self.state["quiz_accuracy"]
        info: dict[str, Any] = {"action": ACTIONS[action]}
        reward = 0.0
        done = False

        if action in (0, 1, 2):
            reward = self._present_question(action, info)
        elif action == 3:
            reward = self._give_hint(info)
        elif action == 4:
            reward = self._review_previous_topic(info)
        elif action == 5:
            reward = self._move_to_next_topic(info)
        elif action == 6:
            reward, done = self._end_session(info)

        # Recompute observed state after the action
        self._refresh_observed_state(prev_qa)

        # Trend-improvement bonus aligned with calculate_reward
        if self.state["quiz_accuracy"] > prev_qa + 0.02:
            reward += 0.5
            info["improvement"] = True

        # Repeated-mistake penalty
        if self._consecutive_wrong >= 2 and self.state["quiz_accuracy"] < 0.4:
            reward -= 0.5
            info["repeated_mistake"] = True

        # Mild fatigue accumulates over time
        self._fatigue = min(1.0, self._fatigue + 0.02)

        self._steps += 1
        self._last_action = action
        if not done and self._steps >= self.MAX_STEPS:
            done = True
            info["timeout"] = True

        return dict(self.state), float(reward), done, info

    # ── Action handlers ───────────────────────────────────────

    def _present_question(self, action: int, info: dict) -> float:
        difficulty = DIFFICULTY_VALUE[action]
        skill = self._true_skill + self._hint_buff - 0.3 * self._fatigue
        # Logistic correctness probability — harder questions vs. lower skill = lower prob
        gap = (skill - difficulty) * 4.0
        p_correct = 1.0 / (1.0 + math.exp(-gap))
        p_correct *= 0.6 + 0.4 * self._engagement  # engaged learners perform better
        p_correct = max(0.05, min(0.95, p_correct))

        is_correct = self.rng.random() < p_correct
        self._quiz_history.append(is_correct)
        # Response time inversely related to skill match; harder = slower
        response_time = max(2.0, self.np_rng.normal(loc=8 + 6 * difficulty - 4 * skill, scale=2.0))
        self._response_times.append(float(response_time))

        # One-shot reward
        reward = 1.0 if is_correct else 0.0
        if is_correct:
            self._consecutive_wrong = 0
            # Skill creeps up faster on harder correct answers (zone of proximal dev)
            self._true_skill = min(1.0, self._true_skill + 0.02 + 0.04 * difficulty)
            self._engagement = min(1.0, self._engagement + 0.05)
            # Mismatch penalty: too-easy correct answer is unproductive
            if difficulty < self._true_skill - 0.3:
                reward -= 0.2
                info["too_easy"] = True
        else:
            self._consecutive_wrong += 1
            self._engagement = max(0.1, self._engagement - 0.07)
            # Mismatch penalty: too-hard miss damages engagement
            if difficulty > self._true_skill + 0.3:
                reward -= 0.3
                info["too_hard"] = True

        # Hint buff is single-use
        self._hint_buff = 0.0
        info["correct"] = is_correct
        info["p_correct"] = round(p_correct, 3)
        return reward

    def _give_hint(self, info: dict) -> float:
        # Short-term skill boost on the next question; small immediate cost (hints aren't free)
        self._hint_buff = 0.15
        self._engagement = min(1.0, self._engagement + 0.02)
        info["hint_used"] = True
        return -0.1

    def _review_previous_topic(self, info: dict) -> float:
        # Small skill consolidation but no question this step
        self._true_skill = min(1.0, self._true_skill + 0.04)
        self._engagement = min(1.0, self._engagement + 0.01)
        # Lab success rate inches up as a side-effect of consolidation
        self._lab_history.append(self.rng.random() < (0.4 + self._true_skill * 0.5))
        if self._lab_history[-1]:
            info["lab_success"] = True
            return 0.7  # matches calculate_reward lab_success bonus
        return 0.0

    def _move_to_next_topic(self, info: dict) -> float:
        # Only productive if learner is actually competent enough
        confidence = self.state.get("topic_confidence", 0.5)
        if confidence >= 0.75 and self.state.get("quiz_accuracy", 0.0) >= 0.7:
            self._engagement = min(1.0, self._engagement + 0.1)
            info["advanced"] = True
            return 1.0  # rewards graduating from a topic
        # Premature advance hurts engagement
        self._engagement = max(0.1, self._engagement - 0.1)
        info["premature_advance"] = True
        return -1.0

    def _end_session(self, info: dict) -> tuple[float, bool]:
        # Reward ending only when productive — otherwise penalise to discourage early quit
        qa = self.state["quiz_accuracy"]
        attempts = len(self._quiz_history)
        if attempts >= 5 and qa >= 0.6:
            info["graceful_end"] = True
            return 1.5, True
        if attempts < 3:
            info["early_quit"] = True
            return -1.5, True
        return 0.0, True

    # ── Observed-state recompute ──────────────────────────────

    def _refresh_observed_state(self, prev_qa: float) -> None:
        # Quiz / MCQ accuracy: EMA over outcomes. Use last 10 if available.
        if self._quiz_history:
            recent = self._quiz_history[-10:]
            qa = sum(recent) / len(recent)
        else:
            qa = prev_qa  # no new question this step
        self.state["quiz_accuracy"] = round(qa, 4)
        self.state["mcq_accuracy"] = round(qa, 4)  # same surface for now

        # Lab success rate
        if self._lab_history:
            self.state["lab_success_rate"] = round(
                sum(self._lab_history[-10:]) / len(self._lab_history[-10:]), 4
            )

        # Trend
        diff = qa - prev_qa
        if diff > 0.02:
            self.state["recent_trend"] = "improving"
        elif diff < -0.02:
            self.state["recent_trend"] = "declining"
        else:
            self.state["recent_trend"] = "stable"

        # Attempts + response time
        self.state["attempts_count"] = len(self._quiz_history)
        if self._response_times:
            self.state["avg_response_time"] = round(
                sum(self._response_times[-10:]) / len(self._response_times[-10:]), 2
            )

        # Topic confidence: blend of accuracy + (1-fatigue) + engagement
        confidence = (
            0.55 * self.state["quiz_accuracy"]
            + 0.25 * (1.0 - self._fatigue)
            + 0.20 * self._engagement
        )
        self.state["topic_confidence"] = round(max(0.0, min(1.0, confidence)), 4)

    # ── Convenience for trainers ──────────────────────────────

    @staticmethod
    def action_space_size() -> int:
        return len(ACTIONS)

    @staticmethod
    def state_size() -> int:
        return 7
