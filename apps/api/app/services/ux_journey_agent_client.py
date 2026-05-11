"""Shared client helpers for talking to the UX-journey browser agent.

Extracted from `app/routers/ux_journey_agent.py` so other modules
(e.g. `services/ux_run_to_journey.py`) can fetch run state without
importing router internals.
"""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException, status

from ..core.config import get_settings


def agent_base_url_or_503() -> tuple[str, float]:
    """Resolve the configured upstream UX-agent base URL or raise HTTP 503.

    Mirrors the previous private helper inside the router; both call-sites now
    share the same lookup so behaviour stays in sync.
    """
    settings = get_settings()
    base = (settings.ux_journey_agent_url or "").strip().rstrip("/")
    if not base:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="UX Journey Agent is not configured (UX_JOURNEY_AGENT_URL).",
        )
    timeout = float(settings.ux_journey_agent_timeout_seconds or 30.0)
    return base, timeout


async def fetch_run_payload(job_id: str) -> dict[str, Any]:
    """GET /run/{job_id} on the upstream agent and return the parsed JSON.

    Errors are translated to FastAPI HTTPException so callers can simply
    bubble them up. Returns the raw dict (typically `{ jobId, status, result, error }`).
    """
    base, timeout = agent_base_url_or_503()
    url = f"{base}/run/{job_id}"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            res = await client.get(url)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="UX Journey Agent request timed out.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to reach UX Journey Agent service.") from exc
    if res.status_code == 404:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UX-journey job not found")
    if res.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"UX Journey Agent error ({res.status_code}).",
        )
    try:
        return res.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="UX Journey Agent returned non-JSON payload.",
        ) from exc
