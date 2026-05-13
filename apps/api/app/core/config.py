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
    openai_api_base_url: str = "https://api.openai.com"
    openai_image_docs_url: str = "https://platform.openai.com/docs/guides/images"
    ai_anthropic_model: str = "claude-3-5-sonnet-20241022"
    # Persona identity JSON generation: defaults to fast/cheap Haiku; override via env if needed.
    ai_persona_identity_anthropic_model: str = "claude-haiku-4-5-20251001"
    # Persona JSON can be long (bio, arrays). Haiku 4.5 supports large outputs; tune down via env if needed.
    ai_persona_identity_max_tokens: int = 32768
    ai_persona_json_repair_max_tokens: int = 32768
    ai_persona_openai_identity_max_tokens: int = 32768
    ai_openai_model: str = "gpt-5.4-mini"
    ai_default_provider: str = "anthropic"
    ai_default_temperature: float = 0.7
    ai_default_max_tokens: int = 4096
    # Project AI Research: large crawl payloads + GPT-5 reasoning can exhaust small completion budgets.
    ai_project_research_max_completion_tokens: int = 16384
    ai_knowledge_templates_path: str | None = None
    # Timeout for AI API HTTP requests (e.g. OpenAI). Long prompts (e.g. journey generation) may need 300s.
    ai_request_timeout_seconds: float = 300.0

    # Auth (JWT)
    auth_jwt_secret: str
    auth_jwt_algorithm: str = "HS256"
    auth_access_token_minutes: int = 60 * 24 * 7  # 7 days

    # PLEXON: same secret as in PLEXON and AUDION web; used for /auth/plexon-sync
    plexon_service_secret: str | None = None
    # PLEXON API base (no trailing path). Alias PLEXON_AUTH_URL matches legacy usage reporting env.
    plexon_api_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("plexon_api_base_url", "PLEXON_API_BASE_URL", "PLEXON_AUTH_URL"),
    )

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

    # Pexels (optional moodboard provider; requires API key)
    pexels_api_base_url: str = "https://api.pexels.com"
    pexels_request_timeout_seconds: float = 20.0
    pexels_user_agent: str = "audion-api (persona moodboards)"
    pexels_api_key: str | None = None

    # Moodboards: sourcing strategy
    # - openverse: stock search (default)
    # - openai: generate images via OpenAI Images API (stores PNGs in DATA_DIR)
    # - auto: use openai when OPENAI_API_KEY is present, otherwise openverse
    moodboard_image_source: Literal["openverse", "openai", "auto"] = "auto"
    moodboard_openai_model: str = "gpt-image-1-mini"
    moodboard_openai_quality: str = "low"
    moodboard_openai_size: str = "1024x1024"
    moodboard_openai_image_count: int = 8
    moodboard_openai_request_timeout_seconds: float = 120.0

    # Upload size limits (bytes). Reject with 413 if exceeded.
    upload_max_document_bytes: int = 10 * 1024 * 1024  # 10 MB for documents
    upload_max_avatar_bytes: int = 5 * 1024 * 1024  # 5 MB for avatar images

    # Easy-setup: optional fetch of a public website for extra project context (best-effort HTML→text).
    easy_setup_url_fetch_timeout_seconds: float = 20.0
    easy_setup_url_max_response_bytes: int = 2 * 1024 * 1024  # 2 MB raw response cap
    easy_setup_url_max_text_chars: int = 16_000  # appended to company_context after strip

    # CHECKION (optional): enrich Project AI Research with Deep Scan page metadata (classification).
    # Server-side only. Requires an API token for a CHECKION user that owns the domain scans (see knowledge).
    checkion_api_base_url: str | None = None
    checkion_api_token: str | None = None
    checkion_request_timeout_seconds: float = 30.0

    # UX Journey Agent (optional): separate service (FastAPI) for browser-use runs.
    ux_journey_agent_url: str | None = Field(default=None, validation_alias=AliasChoices("ux_journey_agent_url", "UX_JOURNEY_AGENT_URL"))
    ux_journey_agent_timeout_seconds: float = 30.0

    # Feature Flags
    use_storion_proxy: bool = False
    storion_sync_poll_interval: float = 5.0
    storion_sync_poll_timeout: float = 300.0


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]



