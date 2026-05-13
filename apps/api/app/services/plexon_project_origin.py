"""Register a new AUDION project on the PLEXON control plane (CHECKION mirror)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from ..core.external_service_urls import PLEXON_PROVISIONING_AUDION_PROJECT_ORIGIN_PATH
from ..core.plexon_contract import (
    PLEXON_CONTRACT_VERSION_HEADER,
    PLEXON_FEDERATION_CONTRACT_VERSION,
    PLEXON_SERVICE_SECRET_HEADER,
)

logger = logging.getLogger(__name__)


def register_audion_project_on_plexon(
    *,
    plexon_api_base_url: str,
    plexon_service_secret: str,
    audion_project_id: str,
    name: str,
    domain: str | None,
    owner_plexon_user_id: str,
    platform_company_id: str,
) -> dict[str, Any]:
    base = plexon_api_base_url.rstrip("/")
    url = f"{base}{PLEXON_PROVISIONING_AUDION_PROJECT_ORIGIN_PATH}"
    payload = {
        "audionProjectId": audion_project_id,
        "name": name,
        "domain": domain,
        "ownerPlexonUserId": owner_plexon_user_id,
        "platformCompanyId": platform_company_id,
    }
    headers = {
        PLEXON_SERVICE_SECRET_HEADER: plexon_service_secret,
        PLEXON_CONTRACT_VERSION_HEADER: PLEXON_FEDERATION_CONTRACT_VERSION,
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, json=payload, headers=headers)
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = ""
        try:
            detail = response.text[:512]
        except Exception:
            pass
        logger.warning("PLEXON audion-project-origin failed: %s %s", exc, detail)
        raise
    data = response.json()
    if not isinstance(data, dict):
        raise ValueError("PLEXON response is not a JSON object")
    return data
