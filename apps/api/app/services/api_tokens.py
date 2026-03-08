"""API tokens for Bearer auth (MCP, integrations). One token per user for all services."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ApiToken, User

TOKEN_PREFIX = "audion_"
TOKEN_BYTES = 32


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_token_string() -> str:
    return TOKEN_PREFIX + secrets.token_hex(TOKEN_BYTES)


def create_api_token(
    session: Session,
    user_id: UUID,
    name: str | None = None,
) -> dict:
    """Create API token for user. Returns id, token (plain, shown once), name, created_at."""
    raw_token = generate_token_string()
    token_hash = hash_token(raw_token)
    api_token = ApiToken(
        id=uuid4(),
        user_id=user_id,
        token_hash=token_hash,
        name=(name or "").strip() or None,
        created_at=datetime.utcnow(),
    )
    session.add(api_token)
    session.flush()
    return {
        "id": str(api_token.id),
        "token": raw_token,
        "name": api_token.name,
        "created_at": api_token.created_at,
    }


def get_user_id_by_token_hash(session: Session, token_hash: str) -> UUID | None:
    row = session.scalar(
        select(ApiToken.user_id).where(ApiToken.token_hash == token_hash).limit(1)
    )
    return row


def list_api_tokens(session: Session, user_id: UUID) -> list[dict]:
    rows = session.scalars(
        select(ApiToken)
        .where(ApiToken.user_id == user_id)
        .order_by(ApiToken.created_at.desc())
    ).all()
    return [
        {"id": str(r.id), "name": r.name, "created_at": r.created_at}
        for r in rows
    ]


def revoke_api_token(session: Session, token_id: str, user_id: UUID) -> bool:
    try:
        token_uuid = UUID(token_id)
    except ValueError:
        return False
    row = session.get(ApiToken, token_uuid)
    if not row or row.user_id != user_id:
        return False
    session.delete(row)
    return True
