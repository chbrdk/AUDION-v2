from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

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

    redis_url: str
    data_dir: str = "/app/data/uploads"
    qdrant_url: str
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str
    neo4j_browser_url: str | None = None
    neo4j_bloom_url: str | None = None

    # AI Providers
    claude_api_key: str | None = None  # Optional, can use OpenAI instead
    openai_api_key: str | None = None
    ai_anthropic_model: str = "claude-3-5-sonnet-20241022"
    ai_openai_model: str = "gpt-4o-mini"
    ai_default_provider: str = "anthropic"
    ai_default_temperature: float = 0.7
    ai_default_max_tokens: int = 4000
    ai_knowledge_templates_path: str | None = None

    # Observability
    otel_exporter_otlp_endpoint: str | None = None
    logfire_token: str | None = None

    # Persona Console
    persona_console_base_url: str = "http://localhost:3000"
    persona_media_base_path: str = "/personas"
    persona_cache_ttl_seconds: int = 300
    persona_backend_public_url: str = "http://localhost:8000"
    persona_backend_docs_url: str = "http://localhost:8000/docs"
    persona_backend_docs_url: str = "http://localhost:8000/docs"
    root_path: str = ""  # For reverse proxy support

    # Feature Flags
    use_storion_proxy: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]




