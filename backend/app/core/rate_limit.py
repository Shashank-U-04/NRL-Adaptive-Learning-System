"""
NRL Adaptive Learning System — Rate Limiting

Uses slowapi (Flask-Limiter port for Starlette/FastAPI). Limits are configured
in core/config.py and can be disabled entirely by setting RATE_LIMIT_ENABLED=false.

Auth endpoints get a stricter limit to slow brute-force attacks.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.config import (
    RATE_LIMIT_AUTH,
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_ENABLED,
)

logger = logging.getLogger("nrl.rate_limit")

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[RATE_LIMIT_DEFAULT] if RATE_LIMIT_ENABLED else [],
    enabled=RATE_LIMIT_ENABLED,
)


def setup_rate_limiting(app: FastAPI) -> None:
    """Wire up the limiter on the FastAPI app."""
    if not RATE_LIMIT_ENABLED:
        logger.info("Rate limiting disabled via RATE_LIMIT_ENABLED=false")
        return

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Rate limit exceeded. Please slow down.",
                "limit": str(exc.detail),
            },
        )

    logger.info(
        f"Rate limiting enabled. Default: {RATE_LIMIT_DEFAULT}, Auth: {RATE_LIMIT_AUTH}"
    )
