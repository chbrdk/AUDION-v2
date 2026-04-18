"""PersonaGenerationService locale resolution (no OpenAI calls)."""

from __future__ import annotations

import os

# Importing persona_generation pulls app.db → get_settings(); satisfy minimal env for collection.
os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_persona_generation_locale.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-persona-generation-locale")

from app.schemas import PersonaGenerateRequest
from app.services.persona_generation import (
    _persona_generation_output_locale,
    _persona_llm_schema_instruction,
)


def test_persona_generation_output_locale_defaults_to_en() -> None:
    assert _persona_generation_output_locale(None) == "en"
    assert _persona_generation_output_locale("") == "en"
    assert _persona_generation_output_locale("  ") == "en"


def test_persona_generation_output_locale_normalizes() -> None:
    assert _persona_generation_output_locale("de") == "de"
    assert _persona_generation_output_locale("EN") == "en"


def test_persona_generate_request_accepts_output_locale() -> None:
    r = PersonaGenerateRequest(project_id="550e8400-e29b-41d4-a716-446655440000", segment="buyers", output_locale="de")
    assert r.output_locale == "de"


def test_persona_llm_schema_instruction_de_contains_german_mandate() -> None:
    de = _persona_llm_schema_instruction("de")
    assert "Hochdeutsch" in de
    en = _persona_llm_schema_instruction("en")
    assert "English" in en and "Hochdeutsch" not in en
