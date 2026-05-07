from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
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
    # Action tools (e.g. inspect_website that triggers the UX Journey Agent)
    # are gated by their own toggle, since they have side effects and require
    # the ux-journey-agent service to be reachable.
    chat_action_tools_enabled: bool = True
    # Direct URL to the apps/ux-journey-agent FastAPI service. We talk to it
    # straight from chat-api (instead of going through persona-api) to avoid a
    # second auth hop — the agent itself is unauthenticated inside the cluster.
    # Leave empty to disable the inspect_website tool at runtime.
    ux_journey_agent_url: str | None = None
    # Overall HTTP timeout for one ux-journey-agent request (start + each poll).
    # The journey itself can run for minutes; the tool tracks it via polling.
    ux_journey_agent_timeout_seconds: float = 60.0
    # How long the inspect_website tool may keep polling before giving up
    # (caps the worst-case open SSE connection back to the browser).
    ux_journey_inspect_total_timeout_seconds: float = 600.0
    # Default browser-step cap if the LLM doesn't supply one.
    ux_journey_inspect_default_max_steps: int = 12
    # Wait between poll iterations.
    ux_journey_poll_interval_seconds: float = 2.0
    # Model used for persona chat (non-streaming /message, stream, voice)
    chat_model: str = "gpt-5.4-nano"
    # Max completion tokens per assistant reply (OpenAI: max_completion_tokens)
    chat_max_completion_tokens: int = 16384
    # Reasoning effort for chat models that support it (e.g. GPT-5 family). "none" = fastest default.
    chat_reasoning_effort_standard: str = "none"
    chat_reasoning_effort_extended: str = "low"
    # Upload size limit for images (bytes). Reject with 413 if exceeded.
    upload_max_image_bytes: int = 10 * 1024 * 1024  # 10 MB for images
    # Temporary chat document uploads (.docx): raw file size and extracted text cap.
    upload_max_document_bytes: int = 15 * 1024 * 1024  # 15 MB
    upload_max_document_chars: int = 200_000
    # TTL for in-memory image/document attachment IDs (seconds).
    upload_attachment_ttl_seconds: int = 3600
    # Reply mode: minimum user message length (chars) to treat as "extended" (see reply_mode.infer_reply_mode).
    chat_extended_min_chars: int = 200
    # Turn naturalness: max imperfection hints per WebSocket session (0 = disable).
    turn_naturalness_max_imperfections_per_session: int = 3
    # When budget allows, actually inject imperfection hint with this probability (0=never, 1=always).
    turn_naturalness_imperfection_probability: float = Field(default=0.35, ge=0.0, le=1.0)
    # HTTP/Voice: in-memory turn session store (session_id + optional user_id).
    turn_naturalness_http_session_ttl_seconds: int = 86400  # drop idle sessions after 24h
    turn_naturalness_http_session_max_entries: int = 50_000


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

