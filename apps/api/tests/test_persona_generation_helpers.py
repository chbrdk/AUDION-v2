from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-persona-helpers")


def test_coerce_str_list() -> None:
    from app.services.persona_generation import _coerce_str_list

    assert _coerce_str_list(None) == []
    assert _coerce_str_list([]) == []
    assert _coerce_str_list([" a ", "b"]) == ["a", "b"]
    assert _coerce_str_list([{"label": "x"}, {"name": "y"}]) == ["x", "y"]
    assert _coerce_str_list("solo") == ["solo"]


def test_parse_age_optional() -> None:
    from app.services.persona_generation import _parse_age_optional

    assert _parse_age_optional(None) is None
    assert _parse_age_optional(42) == 42
    assert _parse_age_optional("About 37 years old") == 37
    assert _parse_age_optional(200) is None


def test_parse_media_affinity_optional() -> None:
    from app.services.persona_generation import _parse_media_affinity_optional

    assert _parse_media_affinity_optional(None) is None
    assert _parse_media_affinity_optional(72) == 72
    assert _parse_media_affinity_optional(150) == 100
    assert _parse_media_affinity_optional("72") == 72


def test_optional_str() -> None:
    from app.services.persona_generation import _optional_str

    assert _optional_str(None) is None
    assert _optional_str("  x  ") == "x"
    assert _optional_str("") is None


def test_parse_goal_priority() -> None:
    from app.services.persona_generation import _parse_goal_priority

    assert _parse_goal_priority(3, 0) == 3
    assert _parse_goal_priority("12", 0) == 12
    assert _parse_goal_priority("high", 0) == 10
    assert _parse_goal_priority("high", 1) == 11
    assert _parse_goal_priority("medium", 2) == 22
    assert _parse_goal_priority("nonsense", 4) == 5


def test_is_placeholder_persona_name() -> None:
    from app.services.persona_generation import _is_placeholder_persona_name

    assert _is_placeholder_persona_name("Pending Persona")
    assert _is_placeholder_persona_name("  pending  ")
    assert _is_placeholder_persona_name("")
    assert not _is_placeholder_persona_name("Anna Becker")


def test_persona_demographics_snapshot_skips_pending() -> None:
    from types import SimpleNamespace

    from app.services.persona_generation import _persona_demographics_snapshot

    pending = SimpleNamespace(
        name="Pending Persona",
        segment="B2B",
        profile={"age": 30, "gender": "female"},
    )
    assert _persona_demographics_snapshot(pending) is None

    real = SimpleNamespace(
        name="Anna Becker",
        segment="B2B Buyer",
        profile={
            "full_name": "Anna Maria Becker",
            "age": 34,
            "gender": "female",
            "location": "Hamburg",
        },
    )
    snap = _persona_demographics_snapshot(real)
    assert snap is not None
    assert snap["name"] == "Anna Becker"
    assert snap["full_name"] == "Anna Maria Becker"
    assert snap["age"] == 34
    assert snap["gender"] == "female"
    assert snap["location"] == "Hamburg"


def test_format_existing_personas_avoidance_block_en_and_de() -> None:
    from app.services.persona_generation import _format_existing_personas_avoidance_block

    snapshots = [
        {
            "name": "Anna Becker",
            "full_name": "Anna Maria Becker",
            "age": 34,
            "gender": "female",
            "location": "Hamburg",
            "segment": "B2B",
            "same_target_group": True,
        }
    ]
    en = _format_existing_personas_avoidance_block(snapshots, "en")
    assert "EXISTING PERSONAS IN THIS PROJECT" in en
    assert "Anna Becker" in en
    assert "same target group" in en
    assert "Do not reuse" in en

    de = _format_existing_personas_avoidance_block(snapshots, "de")
    assert "BEREITS VORHANDENE PERSONAS" in de
    assert "Anzeigename: Anna Becker" in de
    assert "gleiche Zielgruppe" in de

    assert _format_existing_personas_avoidance_block([], "en") == ""
