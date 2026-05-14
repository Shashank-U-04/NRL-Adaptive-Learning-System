"""Tests for learning module endpoints."""

import pytest

from app.models.models import LearningModule, Topic


@pytest.mark.asyncio
async def test_list_modules_empty(client):
    r = await client.get("/api/v1/learning/modules")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert "modules" in body["data"]


@pytest.mark.asyncio
async def test_list_modules_returns_canonical_shape(client, db_session):
    db_session.add(Topic(id="test-topic", title="Test Topic", is_active=True))
    await db_session.flush()
    db_session.add(
        LearningModule(
            topic_id="test-topic",
            content={
                "topic_id": "test-topic",
                "title": "Test Topic",
                "difficulty": 1,
                "estimatedMinutes": 15,
            },
            is_ai_generated=False,
        )
    )
    await db_session.commit()

    r = await client.get("/api/v1/learning/modules")
    assert r.status_code == 200
    body = r.json()
    modules = body["data"]["modules"]

    m = next((x for x in modules if x.get("topic_id") == "test-topic"), None)
    assert m is not None
    assert m["id"] == "test-topic"
    assert m["estimated_minutes"] == 15
    assert m["difficulty"] == "beginner"        # integer 1 → "beginner"
    assert "estimatedMinutes" not in m
    assert "progress" in m


@pytest.mark.asyncio
async def test_get_module_canonical_shape(client, db_session):
    db_session.add(Topic(id="test-detail-topic", title="Detail Topic", is_active=True))
    await db_session.flush()
    db_session.add(
        LearningModule(
            topic_id="test-detail-topic",
            content={
                "id": "test-detail-topic",
                "topic_id": "test-detail-topic",
                "title": "Detail Topic",
                "description": "A test.",
                "difficulty": "beginner",
                "estimated_minutes": 20,
                "lessons": [{"id": "l1", "title": "Lesson 1", "content": "...", "checkpoints": []}],
                "labs": [],
                "quizPool": [],
            },
            is_ai_generated=False,
        )
    )
    await db_session.commit()

    r = await client.get("/api/v1/learning/modules/test-detail-topic")
    assert r.status_code == 200
    body = r.json()
    mod = body["data"]["module"]
    assert mod["id"] == "test-detail-topic"
    assert mod["estimated_minutes"] == 20
    assert isinstance(mod["lessons"], list)
    assert isinstance(mod["labs"], list)
    assert isinstance(mod["quizPool"], list)
    assert "estimatedMinutes" not in mod


@pytest.mark.asyncio
async def test_get_module_normalises_old_shape(client, db_session):
    """Old modules (estimatedMinutes camelCase, int difficulty) must be normalised on read."""
    db_session.add(Topic(id="test-old-topic", title="Old Topic", is_active=True))
    await db_session.flush()
    db_session.add(
        LearningModule(
            topic_id="test-old-topic",
            content={
                "topic_id": "test-old-topic",
                "title": "Old Topic",
                "difficulty": 1,
                "estimatedMinutes": 8,
            },
            is_ai_generated=False,
        )
    )
    await db_session.commit()

    r = await client.get("/api/v1/learning/modules/test-old-topic")
    assert r.status_code == 200
    mod = r.json()["data"]["module"]
    assert mod["id"] == "test-old-topic"
    assert mod["difficulty"] == "beginner"
    assert mod["estimated_minutes"] == 8
    assert isinstance(mod["lessons"], list)
    assert isinstance(mod["labs"], list)
    assert isinstance(mod["quizPool"], list)


@pytest.mark.asyncio
async def test_get_module_not_found(client):
    r = await client.get("/api/v1/learning/modules/nonexistent-xyz-abc")
    assert r.status_code == 404
