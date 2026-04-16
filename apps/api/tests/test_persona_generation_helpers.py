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
