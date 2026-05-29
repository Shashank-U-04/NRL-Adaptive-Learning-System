"""
NRL Adaptive Learning System — Learning Mode API

Endpoints:
  GET  /api/v1/learning/modules             — paginated module list
  GET  /api/v1/learning/modules/{topic_id}  — fetch seeded module by topic slug
  POST /api/v1/learning/mcq                 — submit inline MCQ answer
  POST /api/v1/learning/lab                 — validate lab submission
  POST /api/v1/learning/complete            — mark module completed

Security:
  - topic_id validated against DB allowlist before any operation
  - lab inputs lowercased + trimmed before validation (no raw exec)
  - regex patterns clamped to 'contains' by default; regex only on safe pre-defined patterns
"""

import re
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import (
    LearningModule, LearningEvent, ModuleProgress, Topic, User,
)

logger = logging.getLogger("nrl.learning")
router = APIRouter(prefix="/learning", tags=["Learning Mode"])


# ── Helpers ───────────────────────────────────────────────

async def _validate_topic(topic_id: str, db: AsyncSession) -> Topic:
    """Allowlist check: topic must exist in the topics table."""
    topic = (await db.execute(select(Topic).where(Topic.id == topic_id))).scalar_one_or_none()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Topic '{topic_id}' is not in the allowed topic list.",
        )
    return topic


# ── Schemas ───────────────────────────────────────────────

class MCQSubmission(BaseModel):
    topic_id: str
    block_id: str
    is_correct: bool
    selected_index: int
    time_taken_seconds: int = 0


class LabSubmission(BaseModel):
    topic_id: str
    payload: str
    # Optional: identifies a specific lab inside the module's canonical
    # ``labs[]`` array. When provided, the backend prefers that lab's rules
    # over the legacy ``content[]`` lab block.
    lab_id: str | None = None


class ProgressUpdate(BaseModel):
    topic_id: str
    lesson_id: str | None = None
    lab_id: str | None = None
    quiz_score: int | None = None
    quiz_stats: dict | None = None


# ── Routes ────────────────────────────────────────────────

@router.get("/progress/{topic_id}")
async def get_progress(
    topic_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Fetch user progress for a specific topic.

    Validates the topic first so unknown / typo slugs return 400 rather than
    silently returning an empty progress shape that hides the error.
    """
    await _validate_topic(topic_id, db)

    stmt = select(ModuleProgress).where(
        ModuleProgress.user_id == user.id,
        ModuleProgress.topic_id == topic_id,
    )
    progress = (await db.execute(stmt)).scalar_one_or_none()

    if not progress:
        return {
            "completed_lessons": [],
            "completed_labs": [],
            "quiz_scores": [],
            "is_completed": False,
        }

    return {
        "completed_lessons": progress.completed_lessons,
        "completed_labs": progress.completed_labs,
        "quiz_scores": progress.quiz_scores,
        "is_completed": progress.is_completed,
    }


@router.post("/progress/update")
async def update_progress(
    body: ProgressUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update user progress (lessons, labs, or quiz scores)."""
    await _validate_topic(body.topic_id, db)

    stmt = select(ModuleProgress).where(
        ModuleProgress.user_id == user.id,
        ModuleProgress.topic_id == body.topic_id,
    )
    progress = (await db.execute(stmt)).scalar_one_or_none()

    if not progress:
        progress = ModuleProgress(
            user_id=user.id,
            topic_id=body.topic_id,
            completed_lessons=[],
            completed_labs=[],
            quiz_scores=[]
        )
        db.add(progress)

    if body.lesson_id and body.lesson_id not in progress.completed_lessons:
        # Use a copy to trigger SQLAlchemy change detection for JSONB
        progress.completed_lessons = list(set(progress.completed_lessons + [body.lesson_id]))

    if body.lab_id and body.lab_id not in progress.completed_labs:
        progress.completed_labs = list(set(progress.completed_labs + [body.lab_id]))

    if body.quiz_score is not None:
        new_score = {
            "score": body.quiz_score,
            "stats": body.quiz_stats,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        progress.quiz_scores = progress.quiz_scores + [new_score]
        if body.quiz_score >= 80:
            progress.is_completed = True

    progress.updated_at = datetime.now(timezone.utc)
    # get_db() commits at the end of the request — flush sends the SQL now
    # without locking us into a partial commit before later work.
    await db.flush()
    return {"status": "success", "progress": {
        "completed_lessons": progress.completed_lessons,
        "completed_labs": progress.completed_labs,
        "is_completed": progress.is_completed
    }}

@router.get("/modules")
async def list_modules(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Return paginated list of active learning modules."""
    stmt = (
        select(LearningModule)
        .where(LearningModule.is_active == True)  # noqa: E712
        .limit(limit)
        .offset(offset)
    )
    modules = (await db.execute(stmt)).scalars().all()

    def _difficulty(raw: object) -> str:
        return raw if isinstance(raw, str) else "beginner"

    return {
        "success": True,
        "data": {
            "modules": [
                {
                    "id": m.topic_id,
                    "topic_id": m.topic_id,
                    "title": m.content.get("title", m.topic_id),
                    "description": m.content.get("description", ""),
                    "difficulty": _difficulty(m.content.get("difficulty", "beginner")),
                    "estimated_minutes": (
                        m.content.get("estimated_minutes")
                        or m.content.get("estimatedMinutes")
                        or 10
                    ),
                    "progress": 0,
                }
                for m in modules
            ]
        },
        "limit": limit,
        "offset": offset,
    }


@router.get("/modules/{topic_id}")
async def get_module(
    topic_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve a seeded learning module. Returns 404 if not found;
    run seed.py to populate modules.
    """
    stmt = select(LearningModule).where(
        LearningModule.topic_id == topic_id,
        LearningModule.is_active == True,  # noqa: E712
    )
    module = (await db.execute(stmt)).scalar_one_or_none()
    if not module:
        raise HTTPException(
            status_code=404,
            detail="Module not found. Seed the database to add content.",
        )

    content = module.content

    def _difficulty(raw: object) -> str:
        return raw if isinstance(raw, str) else "beginner"

    normalized = {
        "id": content.get("id") or content.get("topic_id") or topic_id,
        "topic_id": content.get("topic_id", topic_id),
        "title": content.get("title", topic_id),
        "description": content.get("description", ""),
        "difficulty": _difficulty(content.get("difficulty", "beginner")),
        "estimated_minutes": (
            content.get("estimated_minutes")
            or content.get("estimatedMinutes")
            or 10
        ),
        "lessons": content.get("lessons", []),
        "labs": content.get("labs", []),
        "quizPool": content.get("quizPool", []),
        "progress": 0,
    }
    return {"success": True, "data": {"module": normalized}}


@router.post("/mcq", status_code=status.HTTP_200_OK)
async def submit_mcq(
    body: MCQSubmission,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Record inline MCQ answer as a learning event."""
    await _validate_topic(body.topic_id, db)

    event = LearningEvent(
        user_id=user.id,
        topic_id=body.topic_id,
        event_type="mcq",
        is_correct=body.is_correct,
        details={
            "block_id": body.block_id,
            "selected_index": body.selected_index,
            "time_taken_seconds": body.time_taken_seconds,
        },
    )
    db.add(event)
    # get_db commits after the handler returns; flush here for ID assignment only.
    await db.flush()
    logger.info(f"MCQ recorded: user={user.id} topic={body.topic_id} correct={body.is_correct}")
    return {"status": "recorded", "is_correct": body.is_correct}


def _resolve_lab_rules(module_content: dict, lab_id: str | None) -> dict | None:
    """Return a ``{rule_type, pattern, success_message}`` dict for the lab.

    Lookup precedence:
      1. Canonical ``labs[]`` entry whose ``id`` matches ``lab_id`` — uses
         the lab's ``validationRules[]`` if present, otherwise derives a
         "contains" rule from ``expectedOutcome``.
      2. Any canonical lab whose ``expectedOutcome`` is non-empty (when
         ``lab_id`` is absent but exactly one lab exists, or as a fallback).
      3. Legacy ``content[]`` lab block (``type == "lab"``) — unchanged
         from the v1 module shape.

    Returns ``None`` if no validatable lab is found.
    """
    labs = module_content.get("labs") or []

    canonical = None
    if lab_id:
        canonical = next((lab for lab in labs if lab.get("id") == lab_id), None)
    if canonical is None and len(labs) == 1:
        canonical = labs[0]

    if canonical is not None:
        rules = canonical.get("validationRules") or []
        win_rule = next(
            (r for r in rules if r.get("isWin") and r.get("pattern")),
            None,
        ) or next((r for r in rules if r.get("pattern")), None)
        if win_rule:
            return {
                "rule_type": "regex",
                "pattern": str(win_rule["pattern"]).strip(),
                "flags": win_rule.get("flags") or "i",
                "success_message": win_rule.get("response") or "Correct!",
            }
        expected = (canonical.get("expectedOutcome") or "").strip()
        if expected:
            return {
                "rule_type": "contains",
                "pattern": expected.lower(),
                "flags": None,
                "success_message": "Correct!",
            }

    lab_block = next(
        (b for b in module_content.get("content", []) if b.get("type") == "lab"),
        None,
    )
    if lab_block:
        validation = lab_block.get("validation") or {}
        pattern = (validation.get("pattern") or "").strip().lower()
        if pattern:
            return {
                "rule_type": validation.get("rule_type", "contains"),
                "pattern": pattern,
                "flags": None,
                "success_message": lab_block.get("successMessage", "Correct!"),
            }

    return None


@router.post("/lab", status_code=status.HTTP_200_OK)
async def submit_lab(
    body: LabSubmission,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Validate a lab submission against the module's pre-defined rule.

    Input is trimmed and lowercased before comparison (no code execution).
    Canonical ``labs[]`` rules win over the legacy ``content[]`` block.
    """
    await _validate_topic(body.topic_id, db)

    stmt = select(LearningModule).where(
        LearningModule.topic_id == body.topic_id,
        LearningModule.is_active == True,  # noqa: E712
    )
    module = (await db.execute(stmt)).scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found for this topic.")

    rule = _resolve_lab_rules(module.content, body.lab_id)
    if rule is None:
        raise HTTPException(status_code=400, detail="No lab validation rules found for this module.")

    pattern = rule["pattern"]
    rule_type = rule["rule_type"]
    normalized = body.payload.strip().lower()

    # Empty payload is never a pass — closes the "any non-empty input wins" hole.
    if not normalized:
        is_correct = False
    elif rule_type == "contains":
        is_correct = bool(pattern) and pattern in normalized
    elif rule_type == "regex":
        try:
            flags = re.IGNORECASE if (rule.get("flags") or "").lower().find("i") != -1 else 0
            is_correct = re.search(pattern, normalized, flags) is not None
        except re.error:
            logger.error("Invalid regex pattern in lab for topic=%s: %r", body.topic_id, pattern)
            is_correct = False
    else:
        is_correct = normalized == pattern

    event = LearningEvent(
        user_id=user.id,
        topic_id=body.topic_id,
        event_type="lab",
        is_correct=is_correct,
        details={
            "submitted": normalized,
            "pattern": pattern,
            "rule_type": rule_type,
            "lab_id": body.lab_id,
        },
    )
    db.add(event)
    # Same rationale as above — let get_db own the transaction boundary.
    await db.flush()
    logger.info(
        "Lab recorded: user=%s topic=%s lab=%s correct=%s",
        user.id, body.topic_id, body.lab_id, is_correct,
    )

    return {
        "status": "recorded",
        "is_correct": is_correct,
        "message": rule["success_message"] if is_correct else "Incorrect — try again.",
    }


@router.post("/complete", status_code=status.HTTP_200_OK)
async def complete_module_legacy(
    body: ProgressUpdate, # Reuse ProgressUpdate for consistency
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Legacy endpoint for compatibility."""
    return await update_progress(body, db, user)
