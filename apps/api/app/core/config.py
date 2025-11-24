from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_data_dir() -> str:
    project_root = Path(__file__).resolve().parents[3]
    return str(project_root / "data" / "uploads")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "staging", "production"] = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    database_url: str
    redis_url: str
    data_dir: str = Field(default_factory=_default_data_dir)
    qdrant_url: str
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str
    neo4j_browser_url: str = "https://192.168.50.101/neo4j/browser"
    neo4j_bloom_url: str | None = None  # Can be set to https://192.168.50.101/neo4j/bloom if Bloom is available
    claude_api_key: str | None = None
    persona_console_base_url: str = "http://localhost:3000"
    persona_media_base_path: str = "/personas"
    persona_cache_ttl_seconds: int = 300
    persona_backend_public_url: str = "http://localhost:8000"
    persona_backend_docs_url: str = "http://localhost:8000/docs"
    root_path: str = ""  # Set to "/api/persona-backend" when behind reverse proxy

    otel_exporter_otlp_endpoint: str | None = None
    logfire_token: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

