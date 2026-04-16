from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from ..core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


@dataclass(frozen=True)
class PexelsImage:
    image_url: str
    thumb_url: str | None
    source_url: str | None
    author: str | None
    license: str | None
    attribution_text: str | None


def _normalize_photo(item: Dict[str, Any]) -> PexelsImage | None:
    src = item.get("src") if isinstance(item.get("src"), dict) else None
    if not isinstance(src, dict):
        return None

    image_url = src.get("large2x") or src.get("original") or src.get("large") or src.get("medium")
    if not isinstance(image_url, str) or not image_url:
        return None

    thumb = src.get("tiny") or src.get("small") or src.get("medium")
    thumb_url = thumb if isinstance(thumb, str) and thumb else None

    photographer = item.get("photographer")
    author = photographer if isinstance(photographer, str) and photographer else None

    photo_id = item.get("id")
    source_url = f"https://www.pexels.com/photo/{photo_id}" if isinstance(photo_id, int) else None

    attribution = None
    if author and source_url:
        attribution = f"{author} · Pexels · {source_url}"

    return PexelsImage(
        image_url=image_url,
        thumb_url=thumb_url,
        source_url=source_url,
        author=author,
        license="pexels-license",
        attribution_text=attribution,
    )


class PexelsClient:
    def __init__(self) -> None:
        self._base = settings.pexels_api_base_url.rstrip("/")
        self._timeout = settings.pexels_request_timeout_seconds
        self._api_key = (settings.pexels_api_key or "").strip()
        self._headers = {"Authorization": self._api_key, "User-Agent": settings.pexels_user_agent}

    def enabled(self) -> bool:
        return bool(self._api_key)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=0.5, max=3.0))
    def search_photos(self, *, query: str, per_page: int = 15, page: int = 1) -> List[PexelsImage]:
        if not self.enabled():
            return []

        params: Dict[str, Any] = {
            "query": query,
            "per_page": max(1, min(per_page, 80)),
            "page": max(1, page),
        }
        url = f"{self._base}/v1/search"
        with httpx.Client(timeout=self._timeout, headers=self._headers, follow_redirects=True) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()

        photos = payload.get("photos")
        if not isinstance(photos, list):
            return []

        out: List[PexelsImage] = []
        for item in photos:
            if not isinstance(item, dict):
                continue
            img = _normalize_photo(item)
            if img:
                out.append(img)

        logger.info("pexels.search_photos", q=query[:80], results=len(out))
        return out
