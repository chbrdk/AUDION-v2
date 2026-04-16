from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from ..core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


@dataclass(frozen=True)
class OpenverseImage:
    image_url: str
    thumb_url: str | None
    source_url: str | None
    author: str | None
    license: str | None
    attribution_text: str | None


def _normalize_result(item: Dict[str, Any]) -> OpenverseImage | None:
    image_url = item.get("url") or item.get("image") or item.get("image_url")
    if not isinstance(image_url, str) or not image_url:
        return None

    thumb = item.get("thumbnail") or item.get("thumbnail_url") or item.get("thumb_url")
    thumb_url = thumb if isinstance(thumb, str) and thumb else None

    source_url = item.get("foreign_landing_url") or item.get("detail_url") or item.get("source")
    source_url = source_url if isinstance(source_url, str) and source_url else None

    author = item.get("creator") or item.get("creator_name") or item.get("author")
    author = author if isinstance(author, str) and author else None

    license_code = item.get("license") or item.get("license_code")
    license_val = license_code if isinstance(license_code, str) and license_code else None

    attribution = item.get("attribution")
    attribution_text = attribution if isinstance(attribution, str) and attribution else None
    if not attribution_text:
        # Best-effort attribution string (Openverse docs encourage providing one).
        parts = []
        if author:
            parts.append(author)
        if license_val:
            parts.append(license_val.upper())
        if source_url:
            parts.append(source_url)
        attribution_text = " · ".join(parts) if parts else None

    return OpenverseImage(
        image_url=image_url,
        thumb_url=thumb_url,
        source_url=source_url,
        author=author,
        license=license_val,
        attribution_text=attribution_text,
    )


class OpenverseClient:
    def __init__(self) -> None:
        self._base = settings.openverse_api_base_url.rstrip("/")
        self._timeout = settings.openverse_request_timeout_seconds
        self._headers = {"User-Agent": settings.openverse_user_agent}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=0.5, max=3.0))
    def search_images(
        self,
        *,
        q: str,
        page_size: int = 20,
        license_type: str | None = None,
        mature: bool = False,
    ) -> List[OpenverseImage]:
        params: Dict[str, Any] = {
            "q": q,
            "page_size": max(1, min(page_size, 50)),
            "mature": "true" if mature else "false",
        }
        if license_type:
            params["license_type"] = license_type

        url = f"{self._base}/v1/images/"
        with httpx.Client(timeout=self._timeout, headers=self._headers, follow_redirects=True) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()

        results = payload.get("results")
        if not isinstance(results, list):
            return []

        normalized: List[OpenverseImage] = []
        for item in results:
            if not isinstance(item, dict):
                continue
            img = _normalize_result(item)
            if img:
                normalized.append(img)

        logger.info("openverse.search_images", q=q[:80], results=len(normalized))
        return normalized

