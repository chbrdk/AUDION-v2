"""Unit tests for bilingual persona helpers (no FastAPI / DB deps)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

from app.services.persona_bilingual_utils import json_shape_compatible, validate_bilingual_publish


@dataclass
class _FakePrompt:
    system_prompt: str | None
    system_prompt_de: str | None


@dataclass
class _FakePersona:
    headline_de: str | None
    profile: dict[str, Any] | None
    profile_de: dict[str, Any] | None
    profile_card: Any
    profile_card_de: Any


def test_json_shape_compatible_dicts_lists_and_scalars() -> None:
    en = {"a": 1, "b": [{"x": 1}, {"x": 2}], "c": None}
    de_ok = {"a": 99, "b": [{"x": 10}, {"x": 11}], "c": None}
    assert json_shape_compatible(en, de_ok)

    assert not json_shape_compatible(en, {"a": 1})  # missing key
    assert not json_shape_compatible({"a": 1}, {"a": "1"})  # scalar type mismatch
    assert not json_shape_compatible({"a": [1, 2]}, {"a": [1]})  # list length


def test_validate_bilingual_publish_requires_de_mirrors() -> None:
    persona = _FakePersona(
        headline_de="  ",
        profile={"k": 1},
        profile_de=None,
        profile_card=None,
        profile_card_de=None,
    )
    with pytest.raises(ValueError, match="headline_de"):
        validate_bilingual_publish(persona=persona, prompt_model=None)

    persona.headline_de = "Hallo"
    with pytest.raises(ValueError, match="profile_de is required"):
        validate_bilingual_publish(persona=persona, prompt_model=None)

    persona.profile_de = {"k": 2}
    validate_bilingual_publish(persona=persona, prompt_model=None)


def test_validate_bilingual_publish_profile_card_and_prompt_de() -> None:
    persona = _FakePersona(
        headline_de="DE",
        profile={"k": 1},
        profile_de={"k": 2},
        profile_card={"t": 1},
        profile_card_de=None,
    )
    with pytest.raises(ValueError, match="profile_card_de is required"):
        validate_bilingual_publish(persona=persona, prompt_model=None)

    persona.profile_card_de = {"t": 9}
    prompt = _FakePrompt(system_prompt="EN", system_prompt_de="")
    with pytest.raises(ValueError, match="system_prompt_de"):
        validate_bilingual_publish(persona=persona, prompt_model=prompt)

    prompt.system_prompt_de = "DE"
    validate_bilingual_publish(persona=persona, prompt_model=prompt)


def test_migration_defines_expected_columns() -> None:
    root = Path(__file__).resolve().parents[1]
    mig = root / "alembic" / "versions" / "20260417_persona_bilingual_de_columns.py"
    text = mig.read_text(encoding="utf-8")
    for needle in (
        "headline_de",
        "profile_de",
        "profile_card_de",
        "system_prompt_de",
        'schema="audion"',
    ):
        assert needle in text


def test_migration_project_target_group_bilingual_columns() -> None:
    root = Path(__file__).resolve().parents[1]
    mig = root / "alembic" / "versions" / "20260418_project_target_group_bilingual_de.py"
    text = mig.read_text(encoding="utf-8")
    for needle in (
        "name_de",
        "description_de",
        "company_context_de",
        "segment_de",
        '"projects"',
        '"target_groups"',
        'schema="audion"',
    ):
        assert needle in text
