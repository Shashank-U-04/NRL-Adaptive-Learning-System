"""
NRL Adaptive Learning System — Cost & Usage Tracker

Tracks AI provider usage in-memory (per process) and on disk (JSONL).
Surfaces a /metrics endpoint and warns when monthly budget is exceeded.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import AI_MONTHLY_BUDGET_USD, ROOT_DIR

logger = logging.getLogger("nrl.cost")

LOG_DIR = ROOT_DIR / "backend" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
COST_LOG_PATH = LOG_DIR / "ai_costs.jsonl"


class CostTracker:
    """Thread-safe (asyncio) usage + cost tracker."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._monthly: dict[str, dict[str, float]] = defaultdict(
            lambda: {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}
        )
        self._budget_warned_for_month: str | None = None

    async def log(
        self,
        provider: str,
        *,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cost_usd: float = 0.0,
        elapsed_seconds: float = 0.0,
    ) -> None:
        """Record one provider call."""
        month = _current_month()
        key = f"{month}:{provider}"

        async with self._lock:
            stats = self._monthly[key]
            stats["calls"] += 1
            stats["input_tokens"] += int(input_tokens or 0)
            stats["output_tokens"] += int(output_tokens or 0)
            stats["cost_usd"] += float(cost_usd or 0.0)

            month_total = sum(
                v["cost_usd"] for k, v in self._monthly.items() if k.startswith(f"{month}:")
            )

        # Append to JSONL log
        try:
            with COST_LOG_PATH.open("a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "ts": datetime.now(timezone.utc).isoformat(),
                            "provider": provider,
                            "input_tokens": input_tokens,
                            "output_tokens": output_tokens,
                            "cost_usd": round(cost_usd, 6),
                            "elapsed_seconds": round(elapsed_seconds, 3),
                        }
                    )
                    + "\n"
                )
        except OSError:
            pass  # logs are best-effort; do not crash on disk errors

        if month_total > AI_MONTHLY_BUDGET_USD and self._budget_warned_for_month != month:
            logger.warning(
                f"AI BUDGET ALERT: ${month_total:.2f} spent this month "
                f"(limit ${AI_MONTHLY_BUDGET_USD:.2f})."
            )
            self._budget_warned_for_month = month

    async def report(self) -> dict[str, Any]:
        """Return per-month, per-provider summary."""
        async with self._lock:
            grouped: dict[str, dict[str, dict[str, float]]] = defaultdict(dict)
            for key, stats in self._monthly.items():
                month, provider = key.split(":", 1)
                grouped[month][provider] = dict(stats)

        out: dict[str, Any] = {"months": {}, "budget_usd": AI_MONTHLY_BUDGET_USD}
        for month, providers in grouped.items():
            month_total = sum(p["cost_usd"] for p in providers.values())
            out["months"][month] = {
                "providers": providers,
                "total_cost_usd": round(month_total, 4),
                "remaining_usd": round(AI_MONTHLY_BUDGET_USD - month_total, 4),
            }
        return out


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


# Singleton
cost_tracker = CostTracker()
