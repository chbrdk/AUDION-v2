"""
Report usage events to PLEXON (tokens as currency).
Fire-and-forget; errors are logged only.
"""
from __future__ import annotations

import json
import os
import threading
from typing import Any
from urllib.request import Request, urlopen

import structlog

logger = structlog.get_logger(__name__)

PLEXON_AUTH_URL = os.environ.get("PLEXON_AUTH_URL", "").strip()
PLEXON_SERVICE_SECRET = os.environ.get("PLEXON_SERVICE_SECRET", "").strip()
PLEXON_FEDERATION_CONTRACT_VERSION = "2026-05-plexon-federation-v1"


def _report(
    user_id: str,
    event_type: str,
    raw_units: dict[str, Any],
    idempotency_key: str | None = None,
) -> None:
    if not PLEXON_AUTH_URL or not PLEXON_SERVICE_SECRET:
        return
    url = f"{PLEXON_AUTH_URL.rstrip('/')}/api/services/usage/events"
    payload = {
        "user_id": user_id,
        "service": "audion",
        "event_type": event_type,
        "raw_units": raw_units or {},
    }
    if idempotency_key:
        payload["idempotency_key"] = idempotency_key

    try:
        req = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Service-Secret": PLEXON_SERVICE_SECRET,
                "X-Plexon-Contract-Version": PLEXON_FEDERATION_CONTRACT_VERSION,
            },
            method="POST",
        )
        with urlopen(req, timeout=5) as _:
            pass
    except Exception as e:
        logger.warning("usage_report.failed", url=url, error=str(e))


def report_usage(
    user_id: str,
    event_type: str,
    raw_units: dict[str, Any],
    idempotency_key: str | None = None,
) -> None:
    """Report a usage event to PLEXON. Non-blocking."""
    if not user_id or not PLEXON_AUTH_URL or not PLEXON_SERVICE_SECRET:
        return
    thread = threading.Thread(
        target=_report,
        args=(user_id, event_type, raw_units),
        kwargs={"idempotency_key": idempotency_key},
        daemon=True,
    )
    thread.start()


def report_retrieval_query_usage(user_id: str | None, *, queries: int = 1) -> None:
    """BGE encode + Qdrant search (local embedder, bill as fixed tokens in PLEXON)."""
    uid = (user_id or "").strip()
    if not uid:
        return
    q = max(1, int(queries))
    report_usage(uid, "retrieval_query", {"queries": q})
