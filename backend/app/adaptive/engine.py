"""
NRL Adaptive Learning System — Adaptive Engine

Hybrid adaptive engine:
  1. Safety rules always checked first (deterministic override)
  2. Neural DQN policy if model file is present
  3. Rule-based fallback if DQN unavailable

Uses the rich 7-feature state vector aligned with the production RL architecture.
"""

import logging
from pathlib import Path

from app.core.config import RL_MODEL_PATH
from app.adaptive.rules import (
    ACTIONS,
    ACTION_INDICES,
    apply_safety_rules,
    heuristic_fallback,
    calculate_reward,
    initial_state,
)

try:
    import torch
    from app.ml.dqn_model import DQN, encode_state
    TORCH_AVAILABLE = True
except (ImportError, OSError):
    TORCH_AVAILABLE = False

logger = logging.getLogger("nrl.adaptive")


class AdaptiveEngine:
    """
    Production adaptive recommendation engine.
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
        """
        Return (action_name, confidence, explanation).

        Phase 1: Safety rules (always override).
        Phase 2: DQN inference if model loaded.
        Phase 3: Heuristic fallback.
        """
        # Phase 1: Safety rules (always override)
        rule_action, rule_reason = apply_safety_rules(state)
        if rule_action is not None:
            return ACTIONS[rule_action], 0.95, f"[Safety Rule] {rule_reason}"

        # Phase 2: DQN inference
        if self.has_model:
            try:
                return self._dqn_inference(state)
            except Exception as exc:
                logger.error(f"DQN inference failed: {exc} — falling back to rules.")

        # Phase 3: Heuristic fallback
        fb_action, fb_reason = heuristic_fallback(state)
        return ACTIONS[fb_action], 0.70, f"[Heuristic] {fb_reason}"

    @staticmethod
    def calculate_reward(
        is_correct: bool,
        is_improvement: bool = False,
        is_repeated_mistake: bool = False,
        lab_success: bool = False,
    ) -> float:
        """Delegate to the pure function in rules.py."""
        return calculate_reward(
            is_correct=is_correct,
            is_improvement=is_improvement,
            is_repeated_mistake=is_repeated_mistake,
            lab_success=lab_success,
        )

    @staticmethod
    def initial_state() -> dict:
        """Return the neutral cold-start learner state."""
        return initial_state()

    # ── Private helpers ───────────────────────────────────

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

    def _explain(self, action: int, state: dict, confidence: float) -> str:
        name = ACTIONS[action].replace("_", " ")
        qa = state.get("quiz_accuracy", 0.0)
        trend = state.get("recent_trend", "stable")
        return (
            f"[Neural DQN] {name} — "
            f"{qa * 100:.0f}% accuracy, {trend} trend "
            f"(confidence {confidence * 100:.1f}%)"
        )


# ── Singleton ─────────────────────────────────────────────
_engine: AdaptiveEngine | None = None


def get_adaptive_engine() -> AdaptiveEngine:
    global _engine
    if _engine is None:
        _engine = AdaptiveEngine()
    return _engine
