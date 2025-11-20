from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "staging", "production"] = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    database_url: str
    redis_url: str
    qdrant_url: str
    data_dir: Path = Path("./data/uploads")

    otel_exporter_otlp_endpoint: str | None = None
    logfire_token: str | None = None

    @property
    def upload_dir(self) -> Path:
        """Get the upload directory, creating it if it doesn't exist."""
        upload_path = self.data_dir
        upload_path.mkdir(parents=True, exist_ok=True)
        return upload_path


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

