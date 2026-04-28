"""
NRL 2.0 — RL Recommendation Service

Hybrid engine:
  - Loads trained Q-table from trained_agent.pkl (if available)
  - Falls back to rule-based adaptive difficulty
  - 70% deterministic safety rules, 30% Q-table policy
  - Every recommendation includes an explanation string
"""

import logging
import pickle
import random
import sys
from pathlib import Path

from backend.app.core.config import RL_MODEL_PATH, RL_EXPLORATION_RATE

logger = logging.getLogger(__name__)

# ── RL Config (from original prototype) ─────────────────
ACTIONS = {
    0: "Present_Easy_Question",
    1: "Present_Medium_Question",
    2: "Present_Hard_Question",
    3: "Give_Hint",
    4: "Review_Previous_Topic",
    5: "Move_To_Next_Topic",
    6: "End_Session",
}
ACTION_INDICES = {v: k for k, v in ACTIONS.items()}

STATE_FIELDS = [
    "knowledge_level", "current_topic", "question_difficulty",
    "consecutive_correct", "consecutive_wrong", "engagement_score",
]


class RLService:
    """
    Production RL recommendation service.
    Loads the pre-trained Q-table if available, otherwise uses pure rules.
    """

    def __init__(self):
        self.q_table: dict = {}
        self.has_model = False
        self._load_model()

    def _load_model(self) -> None:
        """Load pre-trained Q-table from pickle file."""
        model_path = Path(RL_MODEL_PATH)
        if model_path.exists():
            try:
                with open(model_path, "rb") as f:
                    self.q_table = pickle.load(f)
                self.has_model = True
                num_states = len(self.q_table)
                non_zero = sum(1 for qv in self.q_table.values() for q in qv if q != 0.0)
                logger.info(f"RL model loaded: {num_states} states, {non_zero} non-zero Q-values")
            except Exception as e:
                logger.warning(f"Failed to load RL model: {e} — using rule-based fallback")
        else:
            logger.info(f"No trained model at {model_path} — using rule-based adaptive engine")

    def recommend_action(self, state: dict) -> tuple[str, float, str]:
        """
        Recommend the next teaching action.

        Returns: (action_name, confidence, explanation)
        """
        # Phase 1: Deterministic safety rules (always checked first)
        rule_action, rule_reason = self._apply_rules(state)
        if rule_action is not None:
            return (ACTIONS[rule_action], 0.95, f"[Rule] {rule_reason}")

        # Phase 2: Q-table policy (if model is available)
        if self.has_model:
            state_tuple = self._dict_to_tuple(state)
            if state_tuple in self.q_table:
                q_values = self.q_table[state_tuple]
                max_q = max(q_values)
                best_actions = [i for i, q in enumerate(q_values) if q == max_q]
                q_action = random.choice(best_actions)

                q_range = max(q_values) - min(q_values) if q_values else 0.0
                confidence = min(0.9, 0.5 + (q_range / 50.0))
                explanation = self._explain_q_action(q_action, state, q_values)
                return (ACTIONS[q_action], round(confidence, 2), explanation)

        # Phase 3: Rule-based fallback
        fallback_action, fallback_reason = self._fallback_rules(state)
        return (ACTIONS[fallback_action], 0.7, f"[Adaptive] {fallback_reason}")

    def _apply_rules(self, state: dict) -> tuple[int | None, str]:
        """Safety rules that override everything."""
        kl = state["knowledge_level"]
        cc = state["consecutive_correct"]
        cw = state["consecutive_wrong"]
        eng = state["engagement_score"]

        # Rule 1: Too many wrong → easier question
        if cw >= 2:
            if kl == 0:
                return 0, f"Student has {cw} wrong answers at Beginner — giving Easy question to rebuild confidence"
            return max(0, kl - 1), f"Student struggling with {cw} wrong answers — reducing difficulty"

        # Rule 2: High streak → increase difficulty
        if cc >= 4 and kl < 2:
            return min(2, kl + 1), f"Student answered {cc} consecutive correct — increasing challenge"

        # Rule 3: Engagement critically low
        if eng == 0:
            if cw >= 1:
                return ACTION_INDICES["Give_Hint"], "Engagement is Low + wrong answer — providing hint to re-engage"
            return 0, "Engagement is Low — presenting Easy question to rebuild motivation"

        # Rule 4: Mastered all, high engagement → end session on a high note
        if cc >= 5 and eng == 2 and state["current_topic"] == 2:
            return ACTION_INDICES["End_Session"], "Student mastered all topics with High engagement — ending successfully"

        # Rule 5: Ready for topic progression
        if cc >= 3 and eng >= 1 and state["current_topic"] < 2:
            return ACTION_INDICES["Move_To_Next_Topic"], f"Student has {cc} correct with good engagement — progressing to next topic"

        return None, ""

    def _fallback_rules(self, state: dict) -> tuple[int, str]:
        """Pure rule-based adaptive difficulty when no Q-table is available."""
        kl = state["knowledge_level"]
        cc = state["consecutive_correct"]
        cw = state["consecutive_wrong"]

        # Match difficulty to knowledge level
        if kl == 0:
            if cc >= 2:
                return 1, "Beginner getting comfortable — trying Medium question"
            return 0, "Matching Easy difficulty to Beginner knowledge level"
        elif kl == 1:
            if cc >= 2:
                return 2, "Intermediate on a streak — trying Hard question"
            if cw >= 1:
                return 0, "Intermediate struggled — stepping back to Easy"
            return 1, "Matching Medium difficulty to Intermediate level"
        else:
            if cw >= 1:
                return 1, "Advanced got one wrong — stepping back to Medium"
            return 2, "Matching Hard difficulty to Advanced knowledge level"

    def _explain_q_action(self, action: int, state: dict, q_values: list) -> str:
        """Generate explanation for Q-table decisions."""
        action_name = ACTIONS[action].replace("_", " ")
        kl_names = {0: "Beginner", 1: "Intermediate", 2: "Advanced"}
        eng_names = {0: "Low", 1: "Medium", 2: "High"}

        kl = state["knowledge_level"]
        cc = state["consecutive_correct"]
        eng = state["engagement_score"]
        q_val = q_values[action] if action < len(q_values) else 0

        return (
            f"[AI] Recommended {action_name} — "
            f"student is {kl_names.get(kl, 'Unknown')} level with {cc} correct streak "
            f"and {eng_names.get(eng, 'Unknown')} engagement "
            f"(Q-value: {q_val:.2f})"
        )

    @staticmethod
    def _dict_to_tuple(state: dict) -> tuple:
        return tuple(state[f] for f in STATE_FIELDS)

    @staticmethod
    def initial_state() -> dict:
        return {
            "knowledge_level": 0,
            "current_topic": 0,
            "question_difficulty": 0,
            "consecutive_correct": 0,
            "consecutive_wrong": 0,
            "engagement_score": 1,
        }


# ── Singleton ────────────────────────────────────────────
_rl_service: RLService | None = None


def get_rl_service() -> RLService:
    global _rl_service
    if _rl_service is None:
        _rl_service = RLService()
    return _rl_service
