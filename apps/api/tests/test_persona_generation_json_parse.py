from __future__ import annotations

import os
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_persona_generation_json_parse.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-persona-generation")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "test")
os.environ.setdefault("OPENAI_API_KEY", "test-openai")
os.environ.setdefault("DATA_DIR", "/tmp/audion-test-uploads")

from app.services.persona_generation import _extract_first_json_object


@pytest.mark.parametrize(
    "raw,expected_name",
    [
        ('```json\n{"name":"A","headline":"H","bio":"","traits":{},"pain_points":[],"goals":[],"communication_style":{"vocabulary":[],"sentence_structure":"","skepticism_level":3},"confidence":0.7}\n```', "A"),
        ('{"name":"B","headline":"H","bio":"","traits":{},"pain_points":[],"goals":[],"communication_style":{"vocabulary":[],"sentence_structure":"","skepticism_level":3},"confidence":0.7}\n\nExtra trailing text', "B"),
        ('Some preface...\n{"name":"C","headline":"H","bio":"","traits":{},"pain_points":[],"goals":[],"communication_style":{"vocabulary":[],"sentence_structure":"","skepticism_level":3},"confidence":0.7}\n...suffix', "C"),
    ],
)
def test_parse_identity_json_is_robust(raw: str, expected_name: str) -> None:
    payload = _extract_first_json_object(raw)
    assert payload["name"] == expected_name

