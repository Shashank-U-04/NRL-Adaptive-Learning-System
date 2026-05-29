"""Tests for learning module endpoints."""

import pytest
import jwt as pyjwt

from app.models.models import LearningModule, Topic

_TEST_JWT_SECRET = "test-supabase-jwt-secret-sentinel"


def _auth_headers(sub: str, email: str) -> dict[str, str]:
    token = pyjwt.encode(
        {"sub": sub, "email": email, "aud": "authenticated"},
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


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


# ── Lab validation ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_lab_rejects_empty_input(client, db_session):
    """Empty payloads must NEVER count as success, even if rules are missing."""
    db_session.add(Topic(id="lab-empty", title="Lab Empty", is_active=True))
    await db_session.flush()
    db_session.add(
        LearningModule(
            topic_id="lab-empty",
            content={
                "topic_id": "lab-empty",
                "title": "Lab Empty",
                "labs": [
                    {"id": "l1", "title": "Lab", "expectedOutcome": "sanitize"},
                ],
            },
            is_ai_generated=False,
        )
    )
    await db_session.commit()

    r = await client.post(
        "/api/v1/learning/lab",
        json={"topic_id": "lab-empty", "lab_id": "l1", "payload": "   "},
        headers=_auth_headers("30000000-0000-0000-0000-000000000001", "labtest1@example.com"),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["is_correct"] is False


@pytest.mark.asyncio
async def test_lab_canonical_labs_validate_expected_outcome(client, db_session):
    """A lab with `expectedOutcome` but no validationRules should validate
    via contains-match — not silently accept any text."""
    db_session.add(Topic(id="lab-canonical", title="Lab Canonical", is_active=True))
    await db_session.flush()
    db_session.add(
        LearningModule(
            topic_id="lab-canonical",
            content={
                "topic_id": "lab-canonical",
                "title": "Lab Canonical",
                "labs": [
                    {
                        "id": "lab-1",
                        "title": "Sanitize user input",
                        "expectedOutcome": "sanitize",
                    }
                ],
            },
            is_ai_generated=False,
        )
    )
    await db_session.commit()

    headers = _auth_headers(
        "30000000-0000-0000-0000-000000000002", "labtest2@example.com"
    )

    bad = await client.post(
        "/api/v1/learning/lab",
        json={"topic_id": "lab-canonical", "lab_id": "lab-1", "payload": "DELETE * FROM users"},
        headers=headers,
    )
    assert bad.status_code == 200
    assert bad.json()["is_correct"] is False

    good = await client.post(
        "/api/v1/learning/lab",
        json={"topic_id": "lab-canonical", "lab_id": "lab-1", "payload": "Always sanitize user input"},
        headers=headers,
    )
    assert good.status_code == 200
    assert good.json()["is_correct"] is True


@pytest.mark.asyncio
async def test_lab_legacy_content_block_still_validates(client, db_session):
    """Legacy modules without `labs[]` must still validate via the
    `content[]` lab block — backwards compatibility."""
    db_session.add(Topic(id="lab-legacy", title="Lab Legacy", is_active=True))
    await db_session.flush()
    db_session.add(
        LearningModule(
            topic_id="lab-legacy",
            content={
                "topic_id": "lab-legacy",
                "title": "Lab Legacy",
                "content": [
                    {
                        "type": "lab",
                        "title": "Old lab",
                        "validation": {"rule_type": "contains", "pattern": "validate"},
                        "successMessage": "Good!",
                    }
                ],
            },
            is_ai_generated=False,
        )
    )
    await db_session.commit()

    headers = _auth_headers(
        "30000000-0000-0000-0000-000000000003", "labtest3@example.com"
    )

    fail = await client.post(
        "/api/v1/learning/lab",
        json={"topic_id": "lab-legacy", "payload": "noop"},
        headers=headers,
    )
    assert fail.status_code == 200
    assert fail.json()["is_correct"] is False

    win = await client.post(
        "/api/v1/learning/lab",
        json={"topic_id": "lab-legacy", "payload": "always validate input"},
        headers=headers,
    )
    assert win.status_code == 200
    assert win.json()["is_correct"] is True


@pytest.mark.asyncio
async def test_lab_no_rules_returns_400(client, db_session):
    """A module without any lab content should refuse to validate,
    not silently accept."""
    db_session.add(Topic(id="lab-norules", title="Lab No Rules", is_active=True))
    await db_session.flush()
    db_session.add(
        LearningModule(
            topic_id="lab-norules",
            content={
                "topic_id": "lab-norules",
                "title": "Lab No Rules",
            },
            is_ai_generated=False,
        )
    )
    await db_session.commit()

    r = await client.post(
        "/api/v1/learning/lab",
        json={"topic_id": "lab-norules", "payload": "anything"},
        headers=_auth_headers(
            "30000000-0000-0000-0000-000000000004", "labtest4@example.com"
        ),
    )
    assert r.status_code == 400
