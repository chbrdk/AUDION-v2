from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[4]
CHAT_API_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            CHAT_API_DIR / ".env",
            BASE_DIR / ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "staging", "production"] = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8001

    database_url: str
    qdrant_url: str
    qdrant_api_key: str | None = None  # Required for Qdrant Cloud / secured instances
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str
    anthropic_api_key: str | None = None  # Deprecated, kept for backward compatibility
    indexing_api_url: str = "http://indexing-api:8000"
    elevenlabs_api_key: str | None = None
    elevenlabs_voice_id: str | None = None
    elevenlabs_model_id: str = "eleven_monolingual_v1"
    elevenlabs_base_url: str = "https://api.elevenlabs.io"

    otel_exporter_otlp_endpoint: str | None = None
    logfire_token: str | None = None
    openai_api_key: str  # Required for chat
    # CORS: comma-separated origins. Empty = allow all (dev).
    cors_origins: str = ""
    # Auth: when set, requests must send Authorization: Bearer <key> or X-API-Key: <key>. Empty = no auth.
    auth_api_key: str = ""
    chat_use_tools: bool = True  # Enable tools/functions for chat (default: True)
    # Model used for persona chat (non-streaming /message, stream, voice)
    chat_model: str = "gpt-5.4-nano"
    # Max completion tokens per assistant reply (OpenAI: max_completion_tokens)
    chat_max_completion_tokens: int = 16384
    # Reasoning effort for chat models that support it (e.g. GPT-5 family). "none" = fastest default.
    chat_reasoning_effort_standard: str = "none"
    chat_reasoning_effort_extended: str = "low"
    # Upload size limit for images (bytes). Reject with 413 if exceeded.
    upload_max_image_bytes: int = 10 * 1024 * 1024  # 10 MB for images
    # Reply mode: minimum user message length (chars) to treat as "extended" (see reply_mode.infer_reply_mode).
    chat_extended_min_chars: int = 200
    # Turn naturalness: max imperfection hints per WebSocket session (0 = disable).
    turn_naturalness_max_imperfections_per_session: int = 3


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

