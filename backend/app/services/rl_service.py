"""
NRL Adaptive Learning System — RL Recommendation Service

Hybrid adaptive engine:
  1. Safety rules always checked first (deterministic override)
  2. Neural DQN policy if model file is present
  3. Rule-based fallback if DQN unavailable

Rich state vector (7 features) + explicit reward function per architecture plan.
"""

import logging
from pathlib import Path

from app.core.config import RL_MODEL_PATH

try:
    import torch
    from app.ml.dqn_model import DQN, encode_state
    TORCH_AVAILABLE = True
except (ImportError, OSError):
    TORCH_AVAILABLE = False

logger = logging.getLogger("nrl.rl")

# ── Action Space ─────────────────────────────────────────
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


class RLService:
    """
    Production Neural RL recommendation service.
    Falls back gracefully when PyTorch or trained weights are unavailable.
    """

    def __init__(self) -> None:
        self.model = None
        self.has_model = False
        self.device = None

        if TORCH_AVAILABLE:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self._load_model()
        else:
            logger.warning("PyTorch unavailable — using rule-based adaptive engine.")

    def _load_model(self) -> None:
        model_path = Path(RL_MODEL_PATH)
        if not model_path.exists():
            logger.warning(f"No DQN weights at {model_path} — using rule-based engine.")
            return
        try:
            self.model = DQN(input_size=7, hidden_size=128, output_size=7)
            self.model.load_state_dict(
                torch.load(model_path, map_location=self.device, weights_only=True)
            )
            self.model.to(self.device)
            self.model.eval()
            self.has_model = True
            logger.info(f"DQN model loaded from {model_path} on {self.device}.")
        except Exception as exc:
            logger.error(f"Failed to load DQN model: {exc} — falling back to rules.")

    # ── Public interface ──────────────────────────────────

    def recommend_action(self, state: dict) -> tuple[str, float, str]:
        """Return (action_name, confidence, explanation)."""

        # Phase 1: Safety rules (always override)
        rule_action, rule_reason = self._apply_safety_rules(state)
        if rule_action is not None:
            return ACTIONS[rule_action], 0.95, f"[Safety Rule] {rule_reason}"

        # Phase 2: DQN inference
        if self.has_model:
            try:
                return self._dqn_inference(state)
            except Exception as exc:
                logger.error(f"DQN inference failed: {exc} — falling back to rules.")

        # Phase 3: Heuristic fallback
        fb_action, fb_reason = self._heuristic_fallback(state)
        return ACTIONS[fb_action], 0.70, f"[Heuristic] {fb_reason}"

    @staticmethod
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

    @staticmethod
    def initial_state() -> dict:
        """Cold-start beginner profile."""
        return {
            "quiz_accuracy": 0.5,
            "mcq_accuracy": 0.5,
            "lab_success_rate": 0.5,
            "recent_trend": "stable",
            "attempts_count": 0,
            "avg_response_time": 10.0,
            "topic_confidence": 0.5,
        }

    # ── Private helpers ───────────────────────────────────

    def _apply_safety_rules(self, state: dict) -> tuple[int | None, str]:
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

    def _dqn_inference(self, state: dict) -> tuple[str, float, str]:
        with torch.no_grad():
            tensor = encode_state(state).to(self.device)
            q_values = self.model(tensor)

            # Action masking: prevent topic advancement if confidence is low
            tc = state.get("topic_confidence", 0.5)
            if tc < 0.5:
                q_values[ACTION_INDICES["Move_To_Next_Topic"]] = -1e9

            best_action = int(q_values.argmax().item())

            # Scale-invariant confidence
            sorted_q, _ = torch.sort(q_values, descending=True)
            top1, top2 = sorted_q[0].item(), sorted_q[1].item()
            confidence = min(1.0, max(0.0, (top1 - top2) / (abs(top1) + 1e-6)))

        explanation = self._explain(best_action, state, confidence)
        return ACTIONS[best_action], round(confidence, 2), explanation

    def _heuristic_fallback(self, state: dict) -> tuple[int, str]:
        qa = state.get("quiz_accuracy", 0.5)
        ls = state.get("lab_success_rate", 0.5)

        if qa < 0.4:
            return ACTION_INDICES["Present_Easy_Question"], "Low accuracy — starting with Easy"
        if qa < 0.75:
            if ls < 0.5:
                return ACTION_INDICES["Give_Hint"], "Struggling with labs — providing a hint"
            return ACTION_INDICES["Present_Medium_Question"], "Moderate accuracy — Medium difficulty"
        return ACTION_INDICES["Present_Hard_Question"], "High accuracy — challenging with Hard"

    def _explain(self, action: int, state: dict, confidence: float) -> str:
        name = ACTIONS[action].replace("_", " ")
        qa = state.get("quiz_accuracy", 0.0)
        trend = state.get("recent_trend", "stable")
        return (
            f"[Neural DQN] {name} — "
            f"{qa*100:.0f}% accuracy, {trend} trend "
            f"(confidence {confidence*100:.1f}%)"
        )


# ── Singleton ─────────────────────────────────────────────
_rl_service: RLService | None = None


def get_rl_service() -> RLService:
    global _rl_service
    if _rl_service is None:
        _rl_service = RLService()
    return _rl_service
