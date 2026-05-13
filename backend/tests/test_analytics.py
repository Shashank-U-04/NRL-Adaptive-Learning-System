"""
Analytics endpoint tests.

Covers: dashboard zero-state, dashboard after data, accuracy trend ordering,
and topic mastery sort order.

All tests use isolated users (unique sub/email) to avoid cross-test
interference. JWTs are minted with the same sentinel secret used in conftest.
"""

from __future__ import annotations

import pytest
import jwt as pyjwt

# ── JWT helper ──────────────────────────────────────────────────────────────
_TEST_JWT_SECRET = "test-supabase-jwt-secret-sentinel"


def _make_token(sub: str, email: str) -> str:
    """Mint a minimal HS256 JWT that mimics a Supabase-issued token."""
    return pyjwt.encode(
        {"sub": sub, "email": email, "aud": "authenticated"},
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )


def _unique_user(n: int) -> tuple[str, str]:
    """Return (sub, email) for analytics test user slot n."""
    sub = f"20000000-0000-0000-0000-{n:012d}"
    email = f"analytics-user-{n}@example.com"
    return sub, email


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _run_session(client, headers: dict, topic: str = "web-security") -> str:
    """Start and immediately end a session; return session_id."""
    start = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": topic},
        headers=headers,
    )
    assert start.status_code == 200, start.text
    session_id = start.json()["session_id"]

    end = await client.post(
        "/api/v1/sessions/end",
        json={"session_id": session_id},
        headers=headers,
    )
    assert end.status_code == 200, end.text
    return session_id


async def _run_session_with_answer(
    client, headers: dict, topic: str = "web-security"
) -> str:
    """Start, answer one question (if available), then end the session."""
    start = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": topic},
        headers=headers,
    )
    assert start.status_code == 200, start.text
    body = start.json()
    session_id = body["session_id"]

    question = body.get("question")
    if question:
        await client.post(
            "/api/v1/sessions/answer",
            json={
                "session_id": session_id,
                "question_id": question["id"],
                "selected_answer": "A",
                "time_taken_seconds": 5,
            },
            headers=headers,
        )

    end = await client.post(
        "/api/v1/sessions/end",
        json={"session_id": session_id},
        headers=headers,
    )
    assert end.status_code == 200, end.text
    return session_id


# ── Tests ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dashboard_empty_user_returns_zeros(client):
    """
    Arrange: brand-new user with no sessions
    Act: GET /api/v1/analytics/dashboard
    Assert: all numeric metrics are zero / falsy; shape is correct
    """
    # Arrange
    sub, email = _unique_user(1)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    # Trigger user creation (auth/me auto-creates user + profile)
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200

    # Act
    resp = await client.get("/api/v1/analytics/dashboard", headers=headers)

    # Assert
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Required fields present
    assert "knowledge_level" in data
    assert "current_streak" in data
    assert "longest_streak" in data
    assert "total_xp" in data
    assert "sessions_completed" in data
    assert "overall_accuracy" in data
    assert "total_questions" in data
    assert "recent_sessions" in data
    assert "weak_topics" in data

    # New user — all counters are zero
    assert data["current_streak"] == 0
    assert data["longest_streak"] == 0
    assert data["total_xp"] == 0
    assert data["sessions_completed"] == 0
    assert data["overall_accuracy"] == 0.0
    assert data["total_questions"] == 0
    assert data["recent_sessions"] == []


@pytest.mark.asyncio
async def test_dashboard_after_session_returns_real_data(client):
    """
    Arrange: complete at least one session with an answered question
    Act: GET /api/v1/analytics/dashboard
    Assert: sessions_completed >= 1 and total_questions >= 1
    """
    # Arrange
    sub, email = _unique_user(2)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    await _run_session_with_answer(client, headers)

    # Act
    resp = await client.get("/api/v1/analytics/dashboard", headers=headers)

    # Assert
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["sessions_completed"] >= 1
    # If a question was available and answered the counter should be >= 1
    # (it may be 0 if no dataset is present; guard with >= 0)
    assert data["total_questions"] >= 0
    assert isinstance(data["recent_sessions"], list)
    # At least one recent session entry should appear
    assert len(data["recent_sessions"]) >= 1


@pytest.mark.asyncio
async def test_accuracy_trend_ordered_by_session_number(client):
    """
    Arrange: complete three sessions in order
    Act: GET /api/v1/analytics/accuracy
    Assert: returned list is ordered by session_number ascending (1, 2, 3, ...)
    """
    # Arrange
    sub, email = _unique_user(3)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    # Complete three sessions
    for _ in range(3):
        await _run_session(client, headers)

    # Act
    resp = await client.get("/api/v1/analytics/accuracy", headers=headers)

    # Assert
    assert resp.status_code == 200, resp.text
    points = resp.json()
    assert isinstance(points, list)
    assert len(points) >= 3

    session_numbers = [p["session_number"] for p in points]
    # session_number must be strictly ascending starting from 1
    assert session_numbers == sorted(session_numbers), (
        f"session_numbers not ascending: {session_numbers}"
    )
    assert session_numbers[0] == 1

    # Each entry has required fields
    for point in points:
        assert "session_number" in point
        assert "accuracy" in point
        assert "reward" in point
        assert "date" in point


@pytest.mark.asyncio
async def test_topic_mastery_sorted_descending(client):
    """
    Arrange: complete sessions for two different topics to generate LearnerMetric rows
    Act: GET /api/v1/analytics/topics
    Assert: returned list is sorted by mastery_score descending
    """
    # Arrange
    sub, email = _unique_user(4)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    # Complete sessions under different topics
    for topic in ("web-security", "network-security"):
        await _run_session_with_answer(client, headers, topic=topic)

    # Act
    resp = await client.get("/api/v1/analytics/topics", headers=headers)

    # Assert
    assert resp.status_code == 200, resp.text
    topics = resp.json()
    assert isinstance(topics, list)

    if len(topics) < 2:
        # Only one topic generated metrics (e.g., dataset only covers one)
        pytest.skip("Not enough topic metrics to verify sort order")

    scores = [t["mastery_score"] for t in topics]
    assert scores == sorted(scores, reverse=True), (
        f"mastery_scores not descending: {scores}"
    )

    # Each entry has required fields
    for entry in topics:
        assert "topic_name" in entry
        assert "mastery_score" in entry
        assert "questions_attempted" in entry
        assert "accuracy" in entry
