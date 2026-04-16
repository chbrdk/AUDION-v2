from __future__ import annotations

import base64
import time
from dataclasses import dataclass
from typing import Any, Dict

import httpx
import structlog

from ..core.config import get_settings

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class GeneratedImageBytes:
    png_bytes: bytes
    revised_prompt: str | None = None


class OpenAIImagesClient:
    def __init__(self, *, transport: httpx.BaseTransport | None = None) -> None:
        cfg = get_settings()
        self._base = cfg.openai_api_base_url.rstrip("/")
        self._key = (cfg.openai_api_key or "").strip()
        self._timeout = cfg.moodboard_openai_request_timeout_seconds
        self._transport = transport

    def enabled(self) -> bool:
        return bool(self._key)

    @staticmethod
    def _is_transient(exc: BaseException) -> bool:
        if isinstance(exc, httpx.HTTPStatusError):
            return int(exc.response.status_code) in {408, 409, 429, 500, 502, 503, 504}
        return isinstance(exc, (httpx.TransportError, httpx.TimeoutException))

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

        cfg = get_settings()
        model_name = model or cfg.moodboard_openai_model
        is_gpt_image = isinstance(model_name, str) and model_name.startswith("gpt-image-")

        payload: Dict[str, Any] = {
            "model": model_name,
            "prompt": prompt,
            "n": 1,
            "size": size or cfg.moodboard_openai_size,
        }
        q = quality or cfg.moodboard_openai_quality
        if q:
            payload["quality"] = q

        # GPT Image models support explicit output format; do NOT send `response_format` (DALL·E-only).
        if is_gpt_image:
            payload.setdefault("output_format", "png")
            payload.setdefault("moderation", "low")

        # DALL·E models still use `response_format`.
        if not is_gpt_image:
            payload["response_format"] = "b64_json"

        url = f"{self._base}/v1/images/generations"
        headers = {"Authorization": f"Bearer {self._key}"}

        last_exc: BaseException | None = None
        body: dict[str, Any] | None = None
        for attempt in range(3):
            try:
                with httpx.Client(timeout=self._timeout, headers=headers, transport=self._transport) as client:
                    resp = client.post(url, json=payload)
                    try:
                        resp.raise_for_status()
                    except httpx.HTTPStatusError as exc:
                        detail = exc.response.text
                        logger.error(
                            "openai.images.generation_http_error",
                            status_code=exc.response.status_code,
                            model=model_name,
                            attempt=attempt + 1,
                            detail=detail[:2000],
                        )
                        if self._is_transient(exc) and attempt < 2:
                            last_exc = exc
                            time.sleep(0.35 * (2**attempt))
                            continue
                        raise RuntimeError(f"openai_images_http_{exc.response.status_code}: {detail[:500]}") from exc
                    body = resp.json()
                    break
            except RuntimeError:
                raise
            except (httpx.TransportError, httpx.TimeoutException) as exc:
                if attempt < 2:
                    last_exc = exc
                    time.sleep(0.35 * (2**attempt))
                    continue
                raise

        if body is None:
            raise RuntimeError(f"openai_images_request_failed: {last_exc}") from last_exc

        data = body.get("data")
        if not isinstance(data, list) or not data:
            raise RuntimeError("openai_images_empty_data")

        first = data[0]
        if not isinstance(first, dict):
            raise RuntimeError("openai_images_invalid_data")

        b64 = first.get("b64_json")
        url_field = first.get("url")
        png_bytes: bytes
        if isinstance(b64, str) and b64:
            png_bytes = base64.b64decode(b64)
        elif isinstance(url_field, str) and url_field:
            with httpx.Client(timeout=self._timeout, transport=self._transport) as dl:
                img = dl.get(url_field)
                img.raise_for_status()
                png_bytes = img.content
        else:
            raise RuntimeError("openai_images_missing_image_payload")

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
