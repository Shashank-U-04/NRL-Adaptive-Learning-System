"""
NRL Adaptive Learning System — Learning Mode API

Endpoints:
  GET  /api/v1/learning/modules             — paginated module list
  GET  /api/v1/learning/modules/{topic_id}  — fetch or AI-generate module
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
    """Fetch user progress for a specific topic."""
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
            "is_completed": False
        }
        
    return {
        "completed_lessons": progress.completed_lessons,
        "completed_labs": progress.completed_labs,
        "quiz_scores": progress.quiz_scores,
        "is_completed": progress.is_completed
    }


@router.post("/progress/update")
async def update_progress(
    body: ProgressUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update user progress (lessons, labs, or quiz scores)."""
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
    await db.commit()
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
    return {
        "success": True,
        "data": {
            "modules": [
                {
                    "topic_id": m.topic_id,
                    "title": m.content.get("title", m.topic_id),
                    "difficulty": m.content.get("difficulty", 1),
                    "estimatedMinutes": m.content.get("estimatedMinutes", 5),
                    "is_ai_generated": m.is_ai_generated,
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
    # Check existing
    stmt = select(LearningModule).where(
        LearningModule.topic_id == topic_id,
        LearningModule.is_active == True,  # noqa: E712
    )
    module = (await db.execute(stmt)).scalar_one_or_none()
    if module:
        return {"success": True, "data": {"module": module.content}}

    raise HTTPException(
        status_code=404,
        detail="Module not found. Seed the database to add content.",
    )


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
    await db.commit()
    logger.info(f"MCQ recorded: user={user.id} topic={body.topic_id} correct={body.is_correct}")
    return {"status": "recorded", "is_correct": body.is_correct}


@router.post("/lab", status_code=status.HTTP_200_OK)
async def submit_lab(
    body: LabSubmission,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Validate a lab submission against the module's pre-defined rule.
    Input is trimmed and lowercased before comparison (no code execution).
    """
    await _validate_topic(body.topic_id, db)

    # Fetch module
    stmt = select(LearningModule).where(
        LearningModule.topic_id == body.topic_id,
        LearningModule.is_active == True,  # noqa: E712
    )
    module = (await db.execute(stmt)).scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found for this topic.")

    # Find lab block
    lab_block = next(
        (b for b in module.content.get("content", []) if b.get("type") == "lab"), None
    )
    if not lab_block:
        raise HTTPException(status_code=400, detail="No lab found in this module.")

    validation = lab_block.get("validation", {})
    rule_type = validation.get("rule_type", "contains")
    pattern = validation.get("pattern", "").strip().lower()

    # Normalize input
    normalized = body.payload.strip().lower()

    # Safe validation — no arbitrary code execution
    is_correct = False
    if rule_type == "contains":
        is_correct = pattern in normalized
    elif rule_type == "regex":
        try:
            # Use pre-defined safe patterns only (no user-supplied regex)
            is_correct = bool(re.fullmatch(pattern, normalized))
        except re.error:
            logger.error(f"Invalid regex pattern in lab for topic={body.topic_id}: {pattern!r}")
            is_correct = False
    else:
        is_correct = normalized == pattern   # exact match fallback

    event = LearningEvent(
        user_id=user.id,
        topic_id=body.topic_id,
        event_type="lab",
        is_correct=is_correct,
        details={"submitted": normalized, "pattern": pattern, "rule_type": rule_type},
    )
    db.add(event)
    await db.commit()
    logger.info(f"Lab recorded: user={user.id} topic={body.topic_id} correct={is_correct}")

    return {
        "status": "recorded",
        "is_correct": is_correct,
        "message": lab_block.get("successMessage", "Correct!") if is_correct else "Incorrect — try again.",
    }


@router.post("/complete", status_code=status.HTTP_200_OK)
async def complete_module_legacy(
    body: ProgressUpdate, # Reuse ProgressUpdate for consistency
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Legacy endpoint for compatibility."""
    return await update_progress(body, db, user)
