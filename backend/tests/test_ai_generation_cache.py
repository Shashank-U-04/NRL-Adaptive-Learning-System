"""Cache freshness tests for AI module generation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from backend.app.services import ai_generation_service as svc


class _FakeModule:
    def __init__(self, age_days: int) -> None:
        self.created_at = datetime.now(timezone.utc) - timedelta(days=age_days)
        self.is_active = True


def test_is_fresh_disabled_means_always_fresh(monkeypatch):
    monkeypatch.setattr(svc, "CACHE_EXPIRY_DAYS", 0)
    assert svc._is_fresh(_FakeModule(age_days=10_000)) is True


def test_is_fresh_within_window(monkeypatch):
    monkeypatch.setattr(svc, "CACHE_EXPIRY_DAYS", 30)
    assert svc._is_fresh(_FakeModule(age_days=5)) is True


def test_is_fresh_past_window(monkeypatch):
    monkeypatch.setattr(svc, "CACHE_EXPIRY_DAYS", 30)
    assert svc._is_fresh(_FakeModule(age_days=45)) is False


def test_is_fresh_handles_naive_datetime(monkeypatch):
    """SQLite often round-trips DateTime as naive — the helper must not crash."""
    monkeypatch.setattr(svc, "CACHE_EXPIRY_DAYS", 30)
    mod = _FakeModule(age_days=5)
    mod.created_at = mod.created_at.replace(tzinfo=None)
    assert svc._is_fresh(mod) is True


@pytest.mark.asyncio
async def test_generate_returns_cached_when_fresh(monkeypatch, db_session):
    """When a fresh module exists in DB, generate should return it without calling AI."""
    from backend.app.models.models import LearningModule, Topic

    monkeypatch.setattr(svc, "CACHE_EXPIRY_DAYS", 0)

    topic_id = "fresh-cache-topic"
    db_session.add(Topic(id=topic_id, title="Fresh", description="t", is_active=True))
    db_session.add(
        LearningModule(
            topic_id=topic_id,
            content={"topic_id": topic_id, "title": "Cached", "content": []},
            is_active=True,
            is_ai_generated=True,
        )
    )
    await db_session.commit()

    async def _explode(*_a, **_kw):
        raise AssertionError("AI provider should not be called when cache is fresh")

    monkeypatch.setattr(svc, "get_ai_provider", _explode)

    result = await svc.generate_learning_module(topic_id, db_session)
    assert result["title"] == "Cached"
