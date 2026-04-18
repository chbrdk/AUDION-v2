"""PersonaGenerateRequest accepts output_locale (full schema stack / proto when available)."""

from __future__ import annotations

import importlib.util
import os

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_persona_generate_schema.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-persona-generate-schema")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "test")
os.environ.setdefault("OPENAI_API_KEY", "test-openai")
os.environ.setdefault("DATA_DIR", "/tmp/audion-test-uploads")

if importlib.util.find_spec("msqdx_glass_proto") is None:
    pytest.skip("msqdx_glass_proto not installed (install workspace packages to run)", allow_module_level=True)

from app.schemas import PersonaGenerateRequest


def test_persona_generate_request_accepts_output_locale() -> None:
    r = PersonaGenerateRequest(
        project_id="550e8400-e29b-41d4-a716-446655440000",
        segment="buyers",
        output_locale="de",
    )
    assert r.output_locale == "de"
