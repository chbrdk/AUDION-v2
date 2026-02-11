from __future__ import annotations

from functools import lru_cache
from typing import Optional

import httpx

from ..core.config import get_settings


class ElevenLabsVoiceError(RuntimeError):
    """Raised when ElevenLabs voice synthesis fails."""


class ElevenLabsVoiceClient:
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.elevenlabs_api_key:
            raise ElevenLabsVoiceError("ELEVENLABS_API_KEY is not configured")
        if not settings.elevenlabs_voice_id:
            raise ElevenLabsVoiceError("ELEVENLABS_VOICE_ID is not configured")

        self._api_key = settings.elevenlabs_api_key
        self._voice_id = settings.elevenlabs_voice_id
        self._model_id = settings.elevenlabs_model_id
        self._base_url = settings.elevenlabs_base_url.rstrip("/")
        self._timeout = httpx.Timeout(60.0)
        self._client = httpx.AsyncClient(timeout=self._timeout)

    async def synthesize(self, text: str, voice_id: Optional[str] = None) -> bytes:
        """Convert text to speech using ElevenLabs streaming endpoint."""
        clean_text = text.strip()
        if not clean_text:
            return b""

        payload = {
            "text": clean_text,
            "model_id": self._model_id,
            "voice_settings": {
                "stability": 0.35,
                "similarity_boost": 0.8,
                "style": 0.25,
                "use_speaker_boost": True,
            },
            "optimize_streaming_latency": 2
        }
        headers = {
            "xi-api-key": self._api_key,
            "Accept": "audio/mpeg",
            "Content-Type": "application/json"
        }
        voice = voice_id or self._voice_id
        if not voice:
            raise ElevenLabsVoiceError("Voice ID is not configured")

        url = f"{self._base_url}/v1/text-to-speech/{voice}/stream"
        async with self._client.stream("POST", url, headers=headers, json=payload) as response:
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                detail = exc.response.text
                raise ElevenLabsVoiceError(f"ElevenLabs request failed: {detail}") from exc
            audio_chunks = [chunk async for chunk in response.aiter_bytes()]
        return b"".join(audio_chunks)

    async def aclose(self) -> None:
        await self._client.aclose()


@lru_cache
def get_voice_client() -> ElevenLabsVoiceClient:
    return ElevenLabsVoiceClient()


