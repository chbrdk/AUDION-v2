from __future__ import annotations

import os

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-persona-gen-parse")


def test_parse_persona_generation_json_strips_code_fences_and_repairs_quotes() -> None:
    from app.services.persona_generation import parse_persona_generation_json

    raw = """```json
{
  “name”: “Alex”,
  "age": 34,
  "headline": "Test",
  "bio": "Line 1",
  "pain_points": ["A"],
  "goals": ["B"],
  "traits": {"curious": "high"},
  "communication_style": {"vocabulary": ["x"], "sentence_structure": "short", "skepticism_level": 3},
  "confidence": 0.7
}
```"""
    obj = parse_persona_generation_json(raw)
    assert obj["name"] == "Alex"
    assert obj["age"] == 34


def test_parse_persona_generation_json_errors_on_empty() -> None:
    from app.services.persona_generation import parse_persona_generation_json

    with pytest.raises(ValueError):
        parse_persona_generation_json("")


def test_persona_ai_max_token_settings_defaults() -> None:
    from app.core.config import Settings

    s = Settings(
        database_url="sqlite:///:memory:",
        redis_url="redis://localhost:6379/0",
        auth_jwt_secret="test-persona-token-defaults",
    )
    assert s.ai_persona_identity_max_tokens == 32768
    assert s.ai_persona_json_repair_max_tokens == 32768
    assert s.ai_persona_openai_identity_max_tokens == 32768


def test_parse_persona_generation_json_strips_fence_without_leading_newline() -> None:
    from app.services.persona_generation import parse_persona_generation_json

    raw = (
        '```json{"name": "Pat", "age": 40, "job_title": "x", "headline": "h", '
        '"bio": "b", "pain_points": [], "goals": [], '
        '"traits": {}, "communication_style": {"vocabulary": [], '
        '"sentence_structure": "short", "skepticism_level": 1}, "confidence": 0.5}```'
    )
    obj = parse_persona_generation_json(raw)
    assert obj["name"] == "Pat"
    assert obj["age"] == 40

