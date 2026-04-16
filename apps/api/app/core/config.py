from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[4]
API_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            API_DIR / ".env",
            BASE_DIR / ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "staging", "production"] = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Database - PostgreSQL with audion schema
    database_url: str
    # Connection pool. Defaults allow bursts (e.g. many concurrent GET /personas/:id).
    # Override via DATABASE_POOL_SIZE, DATABASE_POOL_MAX_OVERFLOW if you see QueuePool TimeoutError.
    database_pool_size: int = 15
    database_pool_max_overflow: int = 25
    database_pool_timeout_seconds: float = 30.0
    database_pool_recycle_seconds: int = 600

    redis_url: str
    data_dir: str = "/app/data/uploads"
    # Default to local/dev services so unit tests can import without env noise.
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_verify_ssl: bool = True
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "test"
    neo4j_browser_url: str | None = None
    neo4j_bloom_url: str | None = None

    # AI Providers
    claude_api_key: str | None = Field(default=None, validation_alias=AliasChoices("claude_api_key", "ANTHROPIC_API_KEY"))  # Optional, can use OpenAI instead
    openai_api_key: str | None = None
    ai_anthropic_model: str = "claude-3-5-sonnet-20241022"
    ai_openai_model: str = "gpt-5-mini"
    ai_default_provider: str = "anthropic"
    ai_default_temperature: float = 0.7
    ai_default_max_tokens: int = 4096
    ai_knowledge_templates_path: str | None = None
    # Timeout for AI API HTTP requests (e.g. OpenAI). Long prompts (e.g. journey generation) may need 300s.
    ai_request_timeout_seconds: float = 300.0

    # Auth (JWT)
    auth_jwt_secret: str
    auth_jwt_algorithm: str = "HS256"
    auth_access_token_minutes: int = 60 * 24 * 7  # 7 days

    # PLEXON: same secret as in PLEXON and AUDION web; used for /auth/plexon-sync
    plexon_service_secret: str | None = None

    # Observability
    otel_exporter_otlp_endpoint: str | None = None
    logfire_token: str | None = None

    # Persona Console
    persona_console_base_url: str = "http://localhost:3000"
    persona_media_base_path: str = "/personas"
    persona_cache_ttl_seconds: int = 300
    persona_backend_public_url: str = "http://localhost:8000"
    persona_backend_docs_url: str = "http://localhost:8000/docs"
    root_path: str = ""  # for reverse proxy support

    # CORS: comma-separated origins (e.g. https://app.example.com,https://admin.example.com). Empty = allow all (dev).
    cors_origins: str = ""

    # Tavus (conversational video)
    tavus_api_key: str | None = None
    tavus_api_base: str = "https://tavusapi.com"

    # Openverse (moodboards)
    # Canonical host redirects from api.openverse.engineering → api.openverse.org (301).
    openverse_api_base_url: str = "https://api.openverse.org"
    openverse_request_timeout_seconds: float = 20.0
    openverse_user_agent: str = "audion-api (persona moodboards)"

    # Upload size limits (bytes). Reject with 413 if exceeded.
    upload_max_document_bytes: int = 10 * 1024 * 1024  # 10 MB for documents
    upload_max_avatar_bytes: int = 5 * 1024 * 1024  # 5 MB for avatar images

    # Easy-setup: optional fetch of a public website for extra project context (best-effort HTML→text).
    easy_setup_url_fetch_timeout_seconds: float = 20.0
    easy_setup_url_max_response_bytes: int = 2 * 1024 * 1024  # 2 MB raw response cap
    easy_setup_url_max_text_chars: int = 16_000  # appended to company_context after strip

    # Feature Flags
    use_storion_proxy: bool = False
    storion_sync_poll_interval: float = 5.0
    storion_sync_poll_timeout: float = 300.0


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]



