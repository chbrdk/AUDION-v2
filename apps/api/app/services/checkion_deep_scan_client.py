"""Server-side CHECKION Deep Scan fetch for Project AI Research (optional).

Uses CHECKION Next.js routes:
  GET /api/scan/domain/by-domain?domain=
  GET /api/scan/domain/{scanId}/slim-pages?offset=&limit=

Auth: Authorization: Bearer <checkion_* token>
"""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote, urldefrag, urlparse

import httpx
import structlog

logger = structlog.get_logger(__name__)

_SLIM_PAGE_LIMIT_DEFAULT = 100
_MAX_SLIM_PAGES_TOTAL = 2000


def normalize_checkion_base_url(base: str | None) -> str | None:
    if not base or not str(base).strip():
        return None
    return str(base).strip().rstrip("/")


def hostname_for_checkion_domain(seed_url: str) -> str | None:
    """Match CHECKION `normalizeDomain`: hostname from URL or host-like string."""
    raw = (seed_url or "").strip().lower()
    if not raw:
        return None
    try:
        if not raw.startswith("http://") and not raw.startswith("https://"):
            raw = f"https://{raw}"
        parsed = urlparse(raw)
        host = (parsed.hostname or "").strip().lower()
        return host or None
    except Exception:
        stripped = raw.replace("https://", "").replace("http://", "")
        host = stripped.split("/")[0].strip().lower()
        return host or None


def normalize_url_match_key(url: str) -> str:
    """Stable key for matching CHECKION slim page URL to crawl source URL (host + path, no fragment)."""
    u = (url or "").strip()
    if not u:
        return ""
    u, _ = urldefrag(u)
    try:
        p = urlparse(u)
    except Exception:
        return ""
    host = (p.hostname or "").lower()
    if not host:
        return ""
    path = (p.path or "/").rstrip("/") or ""
    return f"{host}{path}".lower()


def slim_page_to_checkion_payload(page: dict[str, Any]) -> dict[str, Any]:
    """JSON-serializable subset for synthesis (avoid huge nested blobs)."""
    out: dict[str, Any] = {}
    if not isinstance(page, dict):
        return out
    if "pageClassification" in page and page["pageClassification"] is not None:
        out["pageClassification"] = page["pageClassification"]
    if "score" in page and page["score"] is not None:
        out["score"] = page["score"]
    ux = page.get("ux")
    if isinstance(ux, dict) and ux.get("score") is not None:
        out["uxScore"] = ux["score"]
    if "stats" in page and isinstance(page["stats"], dict):
        out["stats"] = page["stats"]
    return out


def _fetch_checkion_with_client(
    client: httpx.Client,
    *,
    base: str,
    headers: dict[str, str],
    domain: str,
    page_limit: int,
    max_pages_total: int,
) -> dict[str, dict[str, Any]]:
    by_domain_url = f"{base}/api/scan/domain/by-domain?domain={quote(domain.strip().lower())}"
    r = client.get(by_domain_url, headers=headers)
    if r.status_code >= 400:
        logger.warning(
            "checkion.by_domain.http_error",
            status_code=r.status_code,
            body_preview=r.text[:200] if r.text else "",
        )
        return {}
    body = r.json()
    if not isinstance(body, dict) or not body.get("success"):
        logger.warning("checkion.by_domain.unexpected_body", body_type=type(body).__name__)
        return {}
    data = body.get("data")
    if not isinstance(data, dict) or not data.get("scanId"):
        logger.info("checkion.by_domain.no_scan", domain=domain)
        return {}
    scan_id = str(data["scanId"])

    out: dict[str, dict[str, Any]] = {}
    offset = 0
    total_seen = 0
    while total_seen < max_pages_total:
        scan_seg = quote(str(scan_id), safe="")
        slim_url = f"{base}/api/scan/domain/{scan_seg}/slim-pages?offset={offset}&limit={page_limit}"
        rs = client.get(slim_url, headers=headers)
        if rs.status_code >= 400:
            logger.warning(
                "checkion.slim_pages.http_error",
                status_code=rs.status_code,
                offset=offset,
                body_preview=rs.text[:200] if rs.text else "",
            )
            break
        slim_body = rs.json()
        if not isinstance(slim_body, dict) or not slim_body.get("success"):
            break
        pages = slim_body.get("data")
        if not isinstance(pages, list):
            break
        total = slim_body.get("total")
        for page in pages:
            if not isinstance(page, dict):
                continue
            u = page.get("url")
            if not isinstance(u, str) or not u.strip():
                continue
            key = normalize_url_match_key(u)
            if not key:
                continue
            payload = slim_page_to_checkion_payload(page)
            if payload:
                out[key] = payload
        batch = len(pages)
        total_seen += batch
        if batch == 0:
            break
        if isinstance(total, int) and offset + batch >= total:
            break
        if batch < page_limit:
            break
        offset += batch

    logger.info(
        "checkion.slim_pages.loaded",
        domain=domain,
        scan_id=scan_id,
        matched_pages=len(out),
    )
    return out


def fetch_checkion_page_metadata_by_domain(
    *,
    base_url: str,
    token: str,
    domain: str,
    timeout_seconds: float = 30.0,
    page_limit: int = _SLIM_PAGE_LIMIT_DEFAULT,
    max_pages_total: int = _MAX_SLIM_PAGES_TOTAL,
    http_client: httpx.Client | None = None,
) -> dict[str, dict[str, Any]]:
    """
    Returns map: normalize_url_match_key(slim_page.url) -> checkion_page payload.
    On any failure or missing scan, returns {} (caller logs).

    ``http_client`` is optional (for tests); when omitted, a short-lived client is created.
    """
    base = normalize_checkion_base_url(base_url)
    if not base or not token or not domain.strip():
        return {}

    headers = {
        "Authorization": f"Bearer {token.strip()}",
        "Accept": "application/json",
    }
    timeout = httpx.Timeout(timeout_seconds, connect=min(10.0, timeout_seconds))

    try:
        if http_client is not None:
            return _fetch_checkion_with_client(
                http_client,
                base=base,
                headers=headers,
                domain=domain,
                page_limit=page_limit,
                max_pages_total=max_pages_total,
            )
        with httpx.Client(timeout=timeout) as client:
            return _fetch_checkion_with_client(
                client,
                base=base,
                headers=headers,
                domain=domain,
                page_limit=page_limit,
                max_pages_total=max_pages_total,
            )
    except httpx.RequestError as e:
        logger.warning("checkion.request_error", error=str(e))
        return {}
    except json.JSONDecodeError as e:
        logger.warning("checkion.json_error", error=str(e))
        return {}
    except Exception as e:
        logger.warning("checkion.unexpected_error", error=str(e))
        return {}
