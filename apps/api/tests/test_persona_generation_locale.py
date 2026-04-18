"""Persona generation locale helpers (prompts module only — no DB/settings)."""

from __future__ import annotations

from app.services.persona_generation_prompts import (
    persona_generation_output_locale,
    persona_llm_schema_instruction,
    system_prompt_persona_identity_anthropic,
    system_prompt_persona_identity_openai,
)


def test_persona_generation_output_locale_defaults_to_en() -> None:
    assert persona_generation_output_locale(None) == "en"
    assert persona_generation_output_locale("") == "en"
    assert persona_generation_output_locale("  ") == "en"


def test_persona_generation_output_locale_normalizes() -> None:
    assert persona_generation_output_locale("de") == "de"
    assert persona_generation_output_locale("EN") == "en"


def test_persona_llm_schema_instruction_de_contains_german_mandate() -> None:
    de = persona_llm_schema_instruction("de")
    assert "Hochdeutsch" in de
    en = persona_llm_schema_instruction("en")
    assert "English" in en and "Hochdeutsch" not in en


def test_system_prompts_openai_de_vs_en() -> None:
    assert "Deutsch" in system_prompt_persona_identity_openai("de")
    assert "English" in system_prompt_persona_identity_openai("en")


def test_system_prompts_anthropic_de_vs_en() -> None:
    assert "Deutsch" in system_prompt_persona_identity_anthropic("de")
    assert "English" in system_prompt_persona_identity_anthropic("en")
