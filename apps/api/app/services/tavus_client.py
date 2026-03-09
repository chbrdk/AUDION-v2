"""Tavus API client for creating CVI (Conversational Video Interface) sessions."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from ..core.config import get_settings

logger = logging.getLogger(__name__)


def create_conversation(
    replica_id: str,
    persona_id: str | None = None,
    conversation_name: str | None = None,
) -> dict[str, Any]:
    """
    Create a Tavus conversation (video call session) via POST /v2/conversations.
    Returns dict with conversation_url, conversation_id, meeting_token (if require_auth), etc.
    """
    settings = get_settings()
    if not settings.tavus_api_key:
        raise ValueError("tavus_api_key not configured")
    base = (settings.tavus_api_base or "").rstrip("/")
    url = f"{base}/v2/conversations"
    payload: dict[str, Any] = {"replica_id": replica_id}
    if persona_id:
        payload["persona_id"] = persona_id
    if conversation_name:
        payload["conversation_name"] = conversation_name
    headers = {
        "Content-Type": "application/json",
        "x-api-key": settings.tavus_api_key,
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        logger.info("tavus.conversation.created", conversation_id=data.get("conversation_id"))
        return data
    except httpx.HTTPStatusError as e:
        logger.warning("tavus.conversation.failed", status=e.response.status_code, body=e.response.text[:500])
        raise
    except httpx.RequestError as e:
        logger.warning("tavus.conversation.request_error", error=str(e))
        raise
