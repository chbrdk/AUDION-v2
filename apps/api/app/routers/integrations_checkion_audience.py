from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..db import get_db
from ..services.audience_report_export import build_audience_report_context

router = APIRouter(prefix="/integrations/checkion", tags=["integrations"])


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


@router.get("/projects/{checkion_project_id}/audience-report")
def get_audience_report_for_checkion_project(
    checkion_project_id: str,
    session: Session = Depends(get_db),
    _: None = Depends(verify_checkion_inbound_service_token),
) -> dict:
    """
    Read-only audience context for CHECKION comprehensive project reports.
    Resolves AUDION project via ``projects.checkion_project_id``.
    """
    return build_audience_report_context(session, checkion_project_id=checkion_project_id)
