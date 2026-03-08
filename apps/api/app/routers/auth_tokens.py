"""API token management: list, create, revoke. Same token for MCP and all services."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import AuthTokenCreateRequest
from ..services.auth import get_current_user
from ..services import api_tokens as api_tokens_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/tokens")
def list_tokens(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """List API tokens for the current user (id, name, createdAt; no secret)."""
    items = api_tokens_service.list_api_tokens(session, current_user.id)
    return {
        "data": [
            {
                "id": i["id"],
                "name": i["name"],
                "createdAt": i["created_at"].isoformat(),
            }
            for i in items
        ],
    }


@router.post("/tokens")
def create_token(
    payload: AuthTokenCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Create an API token. Body: { \"name\": \"optional\" }. Returns token once."""
    name = payload.name.strip() if payload.name else None
    created = api_tokens_service.create_api_token(session, current_user.id, name=name)
    session.commit()
    return {
        "token": created["token"],
        "id": created["id"],
        "name": created["name"],
        "createdAt": created["created_at"].isoformat(),
    }


@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_token(
    token_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Revoke an API token by id. Only own tokens can be revoked."""
    revoked = api_tokens_service.revoke_api_token(session, token_id, current_user.id)
    if not revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found or already revoked",
        )
    session.commit()
