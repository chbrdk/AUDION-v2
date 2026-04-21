"""AI suggestion caching helpers (project-scoped, context-hash keyed)."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy.orm import Session

from ..models import AiSuggestionCache, Project


SUGGEST_TARGET_GROUPS_KIND = "suggest_target_groups"
SUGGESTION_CACHE_PROMPT_VERSION = "2026-04-21:v1"


def stable_context_hash(payload: dict[str, Any]) -> str:
    """sha256 hex of canonical JSON representation."""
    data = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def get_cache_entry(
    session: Session,
    *,
    project_id: str,
    kind: str,
    context_hash: str,
) -> AiSuggestionCache | None:
    return (
        session.query(AiSuggestionCache)
        .where(AiSuggestionCache.project_id == project_id)
        .where(AiSuggestionCache.kind == kind)
        .where(AiSuggestionCache.context_hash == context_hash)
        .order_by(AiSuggestionCache.updated_at.desc())
        .first()
    )


def upsert_cache_entry(
    session: Session,
    *,
    project: Project,
    kind: str,
    context_hash: str,
    request_payload: dict[str, Any],
    response_payload: dict[str, Any],
    meta: dict[str, Any],
) -> AiSuggestionCache:
    existing = get_cache_entry(session, project_id=str(project.id), kind=kind, context_hash=context_hash)
    if existing:
        existing.request_payload = request_payload
        existing.response_payload = response_payload
        existing.meta = meta
        session.commit()
        session.refresh(existing)
        return existing
    row = AiSuggestionCache(
        project_id=project.id,
        kind=kind,
        context_hash=context_hash,
        request_payload=request_payload,
        response_payload=response_payload,
        meta=meta,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row

