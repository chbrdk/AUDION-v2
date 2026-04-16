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

