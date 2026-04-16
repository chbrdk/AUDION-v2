from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any, Dict

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from ..core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


@dataclass(frozen=True)
class GeneratedImageBytes:
    png_bytes: bytes
    revised_prompt: str | None = None


class OpenAIImagesClient:
    def __init__(self, *, transport: httpx.BaseTransport | None = None) -> None:
        self._base = settings.openai_api_base_url.rstrip("/")
        self._key = (settings.openai_api_key or "").strip()
        self._timeout = settings.moodboard_openai_request_timeout_seconds
        self._transport = transport

    def enabled(self) -> bool:
        return bool(self._key)

    @retry(stop=stop_after_attempt(2), wait=wait_exponential_jitter(initial=0.75, max=4.0))
    def generate_png(
        self,
        *,
        prompt: str,
        model: str | None = None,
        size: str | None = None,
        quality: str | None = None,
    ) -> GeneratedImageBytes:
        if not self.enabled():
            raise RuntimeError("openai_api_key_missing")

        payload: Dict[str, Any] = {
            "model": model or settings.moodboard_openai_model,
            "prompt": prompt,
            "n": 1,
            "size": size or settings.moodboard_openai_size,
            "response_format": "b64_json",
        }
        q = quality or settings.moodboard_openai_quality
        if q:
            payload["quality"] = q

        url = f"{self._base}/v1/images/generations"
        headers = {"Authorization": f"Bearer {self._key}"}

        with httpx.Client(timeout=self._timeout, headers=headers, transport=self._transport) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            body = resp.json()

        data = body.get("data")
        if not isinstance(data, list) or not data:
            raise RuntimeError("openai_images_empty_data")

        first = data[0]
        if not isinstance(first, dict):
            raise RuntimeError("openai_images_invalid_data")

        b64 = first.get("b64_json")
        if not isinstance(b64, str) or not b64:
            # Some SDK/docs also mention `url` — handle best-effort.
            raise RuntimeError("openai_images_missing_b64_json")

        png_bytes = base64.b64decode(b64)
        revised = first.get("revised_prompt")
        revised_prompt = revised if isinstance(revised, str) and revised else None

        logger.info(
            "openai.images.generation_ok",
            model=payload["model"],
            size=payload["size"],
            quality=payload.get("quality"),
            bytes=len(png_bytes),
        )
        return GeneratedImageBytes(png_bytes=png_bytes, revised_prompt=revised_prompt)
