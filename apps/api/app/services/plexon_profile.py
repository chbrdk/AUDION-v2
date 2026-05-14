"""Fetch PLEXON service profile fields for the persona API (server-side)."""

from __future__ import annotations

import logging
from urllib.parse import quote

import httpx

from ..core.plexon_contract import (
    PLEXON_CONTRACT_VERSION_HEADER,
    PLEXON_FEDERATION_CONTRACT_VERSION,
    PLEXON_SERVICE_SECRET_HEADER,
)

logger = logging.getLogger(__name__)

_MAX_COMPANY_ID_LEN = 64


def _normalize_company_id(raw: str | None) -> str | None:
    if raw is None or not isinstance(raw, str):
        return None
    s = raw.strip()
    if not s or len(s) > _MAX_COMPANY_ID_LEN:
        return None
    return s


def _default_company_from_profile_response(res: httpx.Response, *, log_key: str, log_val: str) -> str | None:
    if not res.is_success:
        logger.info(
            "audion.plexon_profile.fetch_failed",
            extra={"status": res.status_code, log_key: log_val},
        )
        return None
    try:
        data = res.json()
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    user = data.get("user")
    if not isinstance(user, dict):
        return None
    raw = user.get("default_platform_company_id")
    return _normalize_company_id(raw if isinstance(raw, str) else None)


def fetch_plexon_default_platform_company_id_for_user(
    *,
    plexon_api_base_url: str,
    plexon_service_secret: str,
    plexon_user_id: str,
) -> str | None:
    """GET PLEXON `/api/services/profile?user_id=…` and return ``default_platform_company_id`` if present."""
    base = (plexon_api_base_url or "").strip().rstrip("/")
    secret = (plexon_service_secret or "").strip()
    uid = (plexon_user_id or "").strip()
    if not base or not secret or not uid:
        return None
    url = f"{base}/api/services/profile?user_id={quote(uid, safe='')}"
    headers = {
        PLEXON_SERVICE_SECRET_HEADER: secret,
        PLEXON_CONTRACT_VERSION_HEADER: PLEXON_FEDERATION_CONTRACT_VERSION,
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.get(url, headers=headers)
        return _default_company_from_profile_response(res, log_key="user_id_prefix", log_val=uid[:8])
    except Exception as exc:
        logger.warning("audion.plexon_profile.fetch_error: %s", exc)
        return None


def fetch_plexon_default_platform_company_id_for_email(
    *,
    plexon_api_base_url: str,
    plexon_service_secret: str,
    email: str,
) -> str | None:
    """GET PLEXON `/api/services/profile?email=…` when ``user_id`` lookup is unavailable or empty."""
    base = (plexon_api_base_url or "").strip().rstrip("/")
    secret = (plexon_service_secret or "").strip()
    em = (email or "").strip().lower()
    if not base or not secret or not em:
        return None
    url = f"{base}/api/services/profile?email={quote(em, safe='@._-')}"
    headers = {
        PLEXON_SERVICE_SECRET_HEADER: secret,
        PLEXON_CONTRACT_VERSION_HEADER: PLEXON_FEDERATION_CONTRACT_VERSION,
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.get(url, headers=headers)
        return _default_company_from_profile_response(res, log_key="email_domain", log_val=em.split("@")[-1][:32])
    except Exception as exc:
        logger.warning("audion.plexon_profile.fetch_error_email: %s", exc)
        return None
