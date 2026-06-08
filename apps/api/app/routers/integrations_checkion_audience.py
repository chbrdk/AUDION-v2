from __future__ import annotations

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..db import get_db
from ..services.audience_report_export import (
    build_audience_report_context,
    link_audion_project_to_checkion,
    list_audion_projects_for_checkion_link,
)

router = APIRouter(prefix="/integrations/checkion", tags=["integrations"])
logger = structlog.get_logger(__name__)


def verify_checkion_inbound_service_token(
    authorization: str | None = Header(default=None),
) -> None:
    settings = get_settings()
    expected = (settings.checkion_inbound_service_token or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CHECKION inbound integration is not configured (CHECKION_INBOUND_SERVICE_TOKEN).",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token.")
    token = authorization[7:].strip()
    if token != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid service token.")


class CheckionAudionLinkBody(BaseModel):
    audion_project_id: str = Field(..., min_length=1)


@router.get("/audion-projects")
def list_audion_projects_for_checkion(
    session: Session = Depends(get_db),
    _: None = Depends(verify_checkion_inbound_service_token),
) -> dict:
    """List AUDION projects for CHECKION-side linking UI."""
    return {"items": list_audion_projects_for_checkion_link(session)}


@router.put("/projects/{checkion_project_id}/link")
def link_checkion_project_to_audion(
    checkion_project_id: str,
    body: CheckionAudionLinkBody,
    session: Session = Depends(get_db),
    _: None = Depends(verify_checkion_inbound_service_token),
) -> dict:
    """Set ``checkion_project_id`` on the chosen AUDION project."""
    try:
        audion_id = UUID(body.audion_project_id.strip())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid audion_project_id.") from exc

    result = link_audion_project_to_checkion(
        session,
        checkion_project_id=checkion_project_id,
        audion_project_id=audion_id,
    )
    if not result.get("ok"):
        reason = result.get("reason", "link_failed")
        if reason == "audion_project_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=reason)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)
    return result


@router.get("/projects/{checkion_project_id}/audience-report")
def get_audience_report_for_checkion_project(
    checkion_project_id: str,
    platform_project_id: str | None = Query(default=None),
    session: Session = Depends(get_db),
    _: None = Depends(verify_checkion_inbound_service_token),
) -> dict:
    """
    Read-only audience context for CHECKION comprehensive project reports.
    Resolves AUDION project via ``checkion_project_id`` or ``platform_project_id``.
    """
    try:
        return build_audience_report_context(
            session,
            checkion_project_id=checkion_project_id,
            platform_project_id=platform_project_id,
        )
    except Exception as exc:
        logger.exception(
            "checkion.audience_report_failed",
            checkion_project_id=checkion_project_id,
            platform_project_id=platform_project_id,
        )
        return {"available": False, "reason": "audience_export_failed"}
