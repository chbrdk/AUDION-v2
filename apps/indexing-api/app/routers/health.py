from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


@router.get("/ready")
def readiness_check() -> dict[str, str]:
    """Readiness check endpoint."""
    return {"status": "ready"}

