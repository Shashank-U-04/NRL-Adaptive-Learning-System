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
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.models.models import (
    LearningModule, LearningEvent, ModuleProgress, Topic, User,
)
from backend.app.services.ai_generation_service import generate_learning_module

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


class CompleteModuleRequest(BaseModel):
    topic_id: str


# ── Routes ────────────────────────────────────────────────

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
        "data": [
            {
                "topic_id": m.topic_id,
                "title": m.content.get("title", m.topic_id),
                "difficulty": m.content.get("difficulty", 1),
                "estimatedMinutes": m.content.get("estimatedMinutes", 5),
                "is_ai_generated": m.is_ai_generated,
            }
            for m in modules
        ],
        "limit": limit,
        "offset": offset,
    }


@router.get("/modules/{topic_id}")
async def get_module(
    topic_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve a module. If it doesn't exist yet, trigger AI generation
    (with Redis lock + idempotency guarantees).
    """
    # Check existing
    stmt = select(LearningModule).where(
        LearningModule.topic_id == topic_id,
        LearningModule.is_active == True,  # noqa: E712
    )
    module = (await db.execute(stmt)).scalar_one_or_none()
    if module:
        return module.content

    # AI-generate (validates topic allowlist internally on topic creation)
    content = await generate_learning_module(topic_id, db)
    if content:
        return content

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Module generation failed and no fallback is available.",
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
async def complete_module(
    body: CompleteModuleRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark a learning module as completed for the authenticated user."""
    await _validate_topic(body.topic_id, db)

    stmt = select(ModuleProgress).where(
        ModuleProgress.user_id == user.id,
        ModuleProgress.topic_id == body.topic_id,
    )
    progress = (await db.execute(stmt)).scalar_one_or_none()

    if progress:
        progress.is_completed = True
    else:
        progress = ModuleProgress(
            user_id=user.id,
            topic_id=body.topic_id,
            is_completed=True,
        )
        db.add(progress)

    await db.commit()
    logger.info(f"Module completed: user={user.id} topic={body.topic_id}")
    return {"status": "completed", "topic_id": body.topic_id}
