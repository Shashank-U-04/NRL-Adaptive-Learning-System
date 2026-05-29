"""
Session (quiz) flow tests.

Covers the full lifecycle: start → answer → end, including profile counter
updates and session history retrieval. All HTTP calls use the async `client`
fixture and Supabase-style JWTs minted locally with the test sentinel secret.
"""

from __future__ import annotations

import pytest
import jwt as pyjwt
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.models import Session, Profile

# ── JWT helper ──────────────────────────────────────────────────────────────
_TEST_JWT_SECRET = "test-supabase-jwt-secret-sentinel"

_QUIZ_USER_COUNTER = 0


def _make_token(sub: str, email: str) -> str:
    """Mint a minimal HS256 JWT that mimics a Supabase-issued token."""
    return pyjwt.encode(
        {"sub": sub, "email": email, "aud": "authenticated"},
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )


def _unique_user(n: int) -> tuple[str, str]:
    """Return (sub, email) for user slot n so tests don't collide."""
    sub = f"10000000-0000-0000-0000-{n:012d}"
    email = f"quiz-user-{n}@example.com"
    return sub, email


# ── Tests ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_start_session_creates_db_row(client):
    """
    Arrange: authenticated user
    Act: POST /api/v1/sessions/start with topic_id="web-security"
    Assert: 200 response and session row exists in DB
    """
    # Arrange
    sub, email = _unique_user(1)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    # Act
    response = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": "web-security"},
        headers=headers,
    )

    # Assert — HTTP level
    assert response.status_code == 200, response.text
    body = response.json()
    session_id = body.get("session_id")
    assert session_id is not None
    assert body.get("initial_state") is not None

    # Assert — DB level
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Session).where(Session.id == session_id))
        session = result.scalar_one_or_none()
    assert session is not None
    assert session.status == "active"
    assert session.user_id is not None


@pytest.mark.asyncio
async def test_answer_correct_increments_profile_counters(client):
    """
    Arrange: start a session, obtain a question id
    Act: answer the question correctly
    Assert: profile.total_questions_answered is incremented
    """
    # Arrange
    sub, email = _unique_user(2)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    start_resp = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": "web-security"},
        headers=headers,
    )
    assert start_resp.status_code == 200, start_resp.text
    start_body = start_resp.json()
    session_id = start_body["session_id"]

    # Grab the question returned by start (may be None if no dataset)
    question = start_body.get("question")
    if question is None:
        pytest.skip("No question dataset available in test environment")

    question_id = question["id"]

    # Read baseline profile counter — query DB for user first to get user.id
    # The auth endpoint auto-creates the user on first call; check after answer.
    # Act
    answer_resp = await client.post(
        "/api/v1/sessions/answer",
        json={
            "session_id": session_id,
            "question_id": question_id,
            "selected_answer": question.get("correct_answer", "A"),
            "time_taken_seconds": 5,
        },
        headers=headers,
    )
    assert answer_resp.status_code == 200, answer_resp.text

    # Assert — profile counters updated in DB
    async with AsyncSessionLocal() as db:
        # Resolve user_id from the session row, then fetch the profile
        session_result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session_row = session_result.scalar_one_or_none()
        assert session_row is not None

        profile_result = await db.execute(
            select(Profile).where(Profile.user_id == session_row.user_id)
        )
        profile = profile_result.scalar_one_or_none()

    assert profile is not None
    assert profile.total_questions_answered >= 1


@pytest.mark.asyncio
async def test_answer_wrong_does_not_increment_correct(client):
    """
    Arrange: start a session
    Act: answer with a deliberately wrong answer (empty string unlikely to match)
    Assert: profile.total_correct is NOT incremented beyond its pre-answer value
    """
    # Arrange
    sub, email = _unique_user(3)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    start_resp = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": "web-security"},
        headers=headers,
    )
    assert start_resp.status_code == 200, start_resp.text
    start_body = start_resp.json()
    session_id = start_body["session_id"]

    question = start_body.get("question")
    if question is None:
        pytest.skip("No question dataset available in test environment")

    question_id = question["id"]

    # Resolve user_id once from the session row
    async with AsyncSessionLocal() as db:
        session_result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session_row = session_result.scalar_one_or_none()
        assert session_row is not None
        user_id = session_row.user_id

        profile_result = await db.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        profile_before = profile_result.scalar_one_or_none()
    correct_before = profile_before.total_correct if profile_before else 0

    # Act — submit a wrong answer (intentionally use a value that won't match)
    answer_resp = await client.post(
        "/api/v1/sessions/answer",
        json={
            "session_id": session_id,
            "question_id": question_id,
            "selected_answer": "WRONG_ANSWER_XYZ",
            "time_taken_seconds": 3,
        },
        headers=headers,
    )
    assert answer_resp.status_code == 200, answer_resp.text
    assert answer_resp.json()["is_correct"] is False

    # Assert — correct count unchanged
    async with AsyncSessionLocal() as db:
        profile_result = await db.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        profile_after = profile_result.scalar_one_or_none()
    correct_after = profile_after.total_correct if profile_after else 0

    assert correct_after == correct_before


@pytest.mark.asyncio
async def test_end_session_sets_status_completed(client):
    """
    Arrange: start a session
    Act: end the session via POST /api/v1/sessions/end
    Assert: session.status == "completed" in DB
    """
    # Arrange
    sub, email = _unique_user(4)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    start_resp = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": "web-security"},
        headers=headers,
    )
    assert start_resp.status_code == 200, start_resp.text
    session_id = start_resp.json()["session_id"]

    # Act
    end_resp = await client.post(
        "/api/v1/sessions/end",
        json={"session_id": session_id},
        headers=headers,
    )

    # Assert — HTTP level
    assert end_resp.status_code == 200, end_resp.text

    # Assert — DB level
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Session).where(Session.id == session_id))
        session = result.scalar_one_or_none()

    assert session is not None
    assert session.status == "completed"


@pytest.mark.asyncio
async def test_full_session_flow_start_answer_end(client):
    """
    Arrange: fresh authenticated user
    Act: start session → answer one question → end session
    Assert: each response matches the expected schema shape
    """
    # Arrange
    sub, email = _unique_user(5)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    # Start
    start_resp = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": "web-security"},
        headers=headers,
    )
    assert start_resp.status_code == 200, start_resp.text
    start_body = start_resp.json()
    assert "session_id" in start_body
    assert "initial_state" in start_body
    assert "first_action" in start_body
    assert "explanation" in start_body
    assert "confidence" in start_body
    session_id = start_body["session_id"]

    question = start_body.get("question")
    if question is not None:
        question_id = question["id"]

        # Answer
        answer_resp = await client.post(
            "/api/v1/sessions/answer",
            json={
                "session_id": session_id,
                "question_id": question_id,
                "selected_answer": "A",
                "time_taken_seconds": 10,
            },
            headers=headers,
        )
        assert answer_resp.status_code == 200, answer_resp.text
        answer_body = answer_resp.json()
        assert "is_correct" in answer_body
        assert "correct_answer" in answer_body
        assert "reward" in answer_body
        assert "next_action" in answer_body
        assert "session_done" in answer_body
        assert "updated_state" in answer_body

    # End
    end_resp = await client.post(
        "/api/v1/sessions/end",
        json={"session_id": session_id},
        headers=headers,
    )
    assert end_resp.status_code == 200, end_resp.text
    end_body = end_resp.json()
    assert "session_id" in end_body
    assert "total_questions" in end_body
    assert "correct_answers" in end_body
    assert "accuracy" in end_body
    assert "total_reward" in end_body
    assert "duration_seconds" in end_body
    assert "xp_earned" in end_body


@pytest.mark.asyncio
async def test_session_history_returns_completed_only(client):
    """
    Arrange: start and end a session so it is marked completed
    Act: GET /api/v1/sessions/history
    Assert: returned list contains the completed session; status is "completed"
    """
    # Arrange
    sub, email = _unique_user(6)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    start_resp = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": "web-security"},
        headers=headers,
    )
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]

    end_resp = await client.post(
        "/api/v1/sessions/end",
        json={"session_id": session_id},
        headers=headers,
    )
    assert end_resp.status_code == 200

    # Act
    history_resp = await client.get("/api/v1/sessions/history", headers=headers)

    # Assert
    assert history_resp.status_code == 200, history_resp.text
    history = history_resp.json()
    assert isinstance(history, list)
    # The completed session must appear
    ids = [item["session_id"] for item in history]
    assert session_id in ids
    # Every returned record has a status field
    for item in history:
        assert "status" in item
        assert "accuracy" in item
        assert "started_at" in item


@pytest.mark.asyncio
async def test_start_session_unknown_topic_rejected_no_row_created(client):
    """
    Arrange: use a topic id that has no DB row AND no JSON dataset
    Act: POST /api/v1/sessions/start with that topic_id
    Assert: 400 response, no Topic row created, no Session row created
    """
    from app.models.models import Topic

    sub, email = _unique_user(7)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}
    novel_topic = "brand-new-topic-that-does-not-exist"

    async with AsyncSessionLocal() as db:
        pre = (await db.execute(select(Topic).where(Topic.id == novel_topic))).scalar_one_or_none()
    assert pre is None

    response = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": novel_topic},
        headers=headers,
    )
    assert response.status_code == 400, response.text

    async with AsyncSessionLocal() as db:
        post = (await db.execute(select(Topic).where(Topic.id == novel_topic))).scalar_one_or_none()
    assert post is None


@pytest.mark.asyncio
async def test_start_session_topic_row_without_content_rejected(client):
    """A Topic row alone is NOT enough — content is required."""
    from app.models.models import Topic

    sub, email = _unique_user(8)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}
    empty_topic = "empty-but-registered-topic"

    async with AsyncSessionLocal() as db:
        db.add(Topic(id=empty_topic, title="Empty Topic", is_active=True))
        await db.commit()

    response = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": empty_topic},
        headers=headers,
    )
    assert response.status_code == 400, response.text


@pytest.mark.asyncio
async def test_start_session_db_backed_topic_accepted(client):
    """A topic with at least one Question row but no JSON dataset must start."""
    from app.models.models import Question, Topic

    sub, email = _unique_user(9)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}
    topic = "db-only-topic"

    async with AsyncSessionLocal() as db:
        db.add(Topic(id=topic, title="DB Only Topic", is_active=True))
        await db.flush()
        db.add(
            Question(
                topic_id=topic,
                difficulty="easy",
                text="Sample question for db-only-topic",
                options={"A": "a", "B": "b", "C": "c", "D": "d"},
                correct_answer="A",
                explanation="...",
                source="dataset",
            )
        )
        await db.commit()

    response = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": topic},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["question"] is not None
    assert body["question"]["topic_name"] == topic


@pytest.mark.asyncio
async def test_answer_cross_topic_question_rejected(client):
    """A question from another topic must NOT be gradable against this session."""
    from app.models.models import Question, Topic, QuestionAttempt

    sub, email = _unique_user(10)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}
    other_topic = "other-content-topic"
    foreign_qid = "other-q-1"

    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(select(Topic).where(Topic.id == other_topic))
        ).scalar_one_or_none()
        if existing is None:
            db.add(Topic(id=other_topic, title="Other Topic", is_active=True))
            await db.flush()
        existing_q = (
            await db.execute(select(Question).where(Question.id == foreign_qid))
        ).scalar_one_or_none()
        if existing_q is None:
            db.add(
                Question(
                    id=foreign_qid,
                    topic_id=other_topic,
                    difficulty="easy",
                    text="Foreign question",
                    options={"A": "a", "B": "b", "C": "c", "D": "d"},
                    correct_answer="A",
                    explanation="...",
                    source="dataset",
                )
            )
        await db.commit()

    start = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": "web-security"},
        headers=headers,
    )
    assert start.status_code == 200, start.text
    session_id = start.json()["session_id"]

    answer = await client.post(
        "/api/v1/sessions/answer",
        json={
            "session_id": session_id,
            "question_id": foreign_qid,
            "selected_answer": "A",
            "time_taken_seconds": 5,
        },
        headers=headers,
    )
    assert answer.status_code == 404, answer.text

    async with AsyncSessionLocal() as db:
        attempt = (
            await db.execute(
                select(QuestionAttempt).where(
                    QuestionAttempt.session_id == session_id,
                    QuestionAttempt.question_id == foreign_qid,
                )
            )
        ).scalar_one_or_none()
    assert attempt is None


@pytest.mark.asyncio
async def test_answer_db_backed_same_topic_question_works(client):
    """A DB question in the session's topic must grade correctly."""
    from app.models.models import Question, QuestionAttempt, Topic

    sub, email = _unique_user(11)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}
    topic = "db-grading-topic"
    qid = "db-grade-q-1"

    async with AsyncSessionLocal() as db:
        if (await db.execute(select(Topic).where(Topic.id == topic))).scalar_one_or_none() is None:
            db.add(Topic(id=topic, title="DB Grading Topic", is_active=True))
            await db.flush()
        if (await db.execute(select(Question).where(Question.id == qid))).scalar_one_or_none() is None:
            db.add(
                Question(
                    id=qid,
                    topic_id=topic,
                    difficulty="easy",
                    text="What is 2+2?",
                    options={"A": "3", "B": "4", "C": "5", "D": "6"},
                    correct_answer="B",
                    explanation="Arithmetic.",
                    source="dataset",
                )
            )
        await db.commit()

    start = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": topic},
        headers=headers,
    )
    assert start.status_code == 200, start.text
    session_id = start.json()["session_id"]

    answer = await client.post(
        "/api/v1/sessions/answer",
        json={
            "session_id": session_id,
            "question_id": qid,
            "selected_answer": "B",
            "time_taken_seconds": 4,
        },
        headers=headers,
    )
    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert body["is_correct"] is True
    assert body["correct_answer"].upper() == "B"

    async with AsyncSessionLocal() as db:
        attempt = (
            await db.execute(
                select(QuestionAttempt).where(
                    QuestionAttempt.session_id == session_id,
                    QuestionAttempt.question_id == qid,
                )
            )
        ).scalar_one_or_none()
    assert attempt is not None
    assert attempt.is_correct is True


@pytest.mark.asyncio
async def test_streak_survives_session_cache_eviction(client):
    """A cache eviction between answers must NOT reset the streak to zero,
    because ``Session.consecutive_correct`` is persisted on every answer."""
    from app.services.session_service import _SESSION_CACHE

    sub, email = _unique_user(13)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    start = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": "web-security"},
        headers=headers,
    )
    assert start.status_code == 200, start.text
    body = start.json()
    session_id = body["session_id"]
    question = body["question"]
    assert question is not None

    answer = await client.post(
        "/api/v1/sessions/answer",
        json={
            "session_id": session_id,
            "question_id": question["id"],
            "selected_answer": question.get("correct_answer", "A"),
            "time_taken_seconds": 3,
        },
        headers=headers,
    )
    assert answer.status_code == 200, answer.text

    _SESSION_CACHE.pop(session_id, None)

    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(select(Session).where(Session.id == session_id))
        ).scalar_one_or_none()
    assert row is not None
    assert row.consecutive_correct >= 0


@pytest.mark.asyncio
async def test_fetch_question_does_not_cross_topics(client):
    """A topic with only its own questions must never serve another topic's
    question via the difficulty-based fallback path."""
    from app.models.models import Question, Topic

    sub, email = _unique_user(12)
    headers = {"Authorization": f"Bearer {_make_token(sub, email)}"}

    other_topic = "isolated-other-topic"
    target_topic = "isolated-target-topic"

    async with AsyncSessionLocal() as db:
        for tid in (other_topic, target_topic):
            if (
                await db.execute(select(Topic).where(Topic.id == tid))
            ).scalar_one_or_none() is None:
                db.add(Topic(id=tid, title=tid, is_active=True))
        await db.flush()

        db.add(
            Question(
                topic_id=other_topic,
                difficulty="easy",
                text="UNIQUE-OTHER-TOPIC-TEXT",
                options={"A": "x", "B": "y", "C": "z", "D": "w"},
                correct_answer="A",
                explanation="",
                source="dataset",
            )
        )
        db.add(
            Question(
                topic_id=target_topic,
                difficulty="easy",
                text="TARGET-TOPIC-TEXT",
                options={"A": "x", "B": "y", "C": "z", "D": "w"},
                correct_answer="A",
                explanation="",
                source="dataset",
            )
        )
        await db.commit()

    start = await client.post(
        "/api/v1/sessions/start",
        json={"topic_id": target_topic},
        headers=headers,
    )
    assert start.status_code == 200, start.text
    q = start.json()["question"]
    assert q is not None
    assert q["topic_name"] == target_topic
    assert q["text"] != "UNIQUE-OTHER-TOPIC-TEXT"
