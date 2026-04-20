from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..core.config import get_settings
from ..models import User
from ..schemas.projects import CheckionProjectItem, CheckionProjectListResponse
from ..services.auth import get_current_user
from ..services.checkion_deep_scan_client import list_checkion_projects as fetch_checkion_project_rows

router = APIRouter(prefix="/integrations/checkion", tags=["integrations"])


@router.get("/projects", response_model=CheckionProjectListResponse)
def list_checkion_projects_for_ui(current_user: User = Depends(get_current_user)) -> CheckionProjectListResponse:
    """List CHECKION projects visible to the integration token (for linking an AUDION project)."""
    del current_user  # auth only
    settings = get_settings()
    base = (settings.checkion_api_base_url or "").strip()
    token = (settings.checkion_api_token or "").strip()
    if not base or not token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CHECKION integration is not configured (CHECKION_API_BASE_URL / CHECKION_API_TOKEN).",
        )
    rows = fetch_checkion_project_rows(
        base_url=base,
        token=token,
        timeout_seconds=float(settings.checkion_request_timeout_seconds or 30.0),
    )
    items = [
        CheckionProjectItem(id=r["id"], name=r.get("name") or "", domain=r.get("domain"))
        for r in rows
    ]
    return CheckionProjectListResponse(items=items)
