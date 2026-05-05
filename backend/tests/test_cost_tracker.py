"""Cost tracker unit tests."""

import pytest

from backend.app.core.cost_tracker import CostTracker


@pytest.mark.asyncio
async def test_log_and_report():
    tracker = CostTracker()
    await tracker.log("ollama", input_tokens=100, output_tokens=50, cost_usd=0.0)
    await tracker.log("openai", input_tokens=200, output_tokens=80, cost_usd=0.0034)
    report = await tracker.report()
    assert "months" in report
    months = report["months"]
    assert len(months) >= 1
    month_data = next(iter(months.values()))
    assert "ollama" in month_data["providers"]
    assert "openai" in month_data["providers"]
    assert month_data["providers"]["openai"]["cost_usd"] == pytest.approx(0.0034)
