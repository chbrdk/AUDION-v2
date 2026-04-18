"""PersonaGenerationService.translate_ui_string_map (mocked OpenAI)."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

# Importing app services loads Settings; provide minimal env for CI/local without .env.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("AUTH_JWT_SECRET", "unit-test-jwt-secret-unit-test-jwt-secret")

from app.services.persona_generation import PersonaGenerationService


def test_translate_ui_string_map_rejects_bad_locale() -> None:
    svc = PersonaGenerationService()
    with pytest.raises(ValueError, match="translate_invalid_locale"):
        svc.translate_ui_string_map(from_locale="fr", strings={"bio": "x"})


def test_translate_ui_string_map_empty_returns_empty() -> None:
    svc = PersonaGenerationService()
    assert svc.translate_ui_string_map(from_locale="en", strings={}) == {}
    assert svc.translate_ui_string_map(from_locale="en", strings={"bio": "  "}) == {}


def test_translate_ui_string_map_parses_openai_json() -> None:
    svc = PersonaGenerationService()
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content='{"bio": "Deutsche Bio", "location": "Berlin"}'))]
    )
    with patch.object(PersonaGenerationService, "_openai_for_json_repair", return_value=mock_client):
        out = svc.translate_ui_string_map(
            from_locale="en",
            strings={"bio": "English bio", "location": "Berlin"},
        )
    assert out["bio"] == "Deutsche Bio"
    assert out["location"] == "Berlin"
