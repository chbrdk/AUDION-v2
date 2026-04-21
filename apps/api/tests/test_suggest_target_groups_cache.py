"""Suggest-target-groups cache hit/miss behavior (mocked)."""

from __future__ import annotations

import os
from unittest.mock import patch
from uuid import uuid4

import importlib.util

import pytest

if importlib.util.find_spec("fastapi") is None:
    pytest.skip("fastapi not installed in this environment (run with project venv/uv)", allow_module_level=True)

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_suggest_tg_cache.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-suggest-tg-cache")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("OPENAI_API_KEY", "test-openai")
os.environ.setdefault("DATA_DIR", "/tmp/audion-test-uploads-suggest-tg-cache")

from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.db import engine  # noqa: E402

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def _register_user() -> str:
    email = f"tg_cache_{uuid4().hex[:12]}@example.com"
    r = client.post("/auth/register", json={"email": email, "password": "test-password-123", "name": "Tester"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@patch("app.routers.projects.run_suggest_target_groups")
@patch("app.routers.projects.get_cache_entry")
def test_suggest_target_groups_cache_hit_skips_llm(mock_get_cache, mock_run):
    mock_get_cache.return_value = type(
        "Row",
        (),
        {
            "response_payload": {
                "suggestions": [
                    {
                        "name": "A",
                        "segment": "a",
                        "description": "d",
                        "relevance_score": 10,
                        "relevance_reason": "x",
                        "relevance_score_deterministic": 10,
                        "relevance_signals": [],
                    }
                ]
            }
        },
    )()
    token = _register_user()
    pr = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "P", "company_context": "ctx"})
    assert pr.status_code == 201, pr.text
    pid = pr.json()["id"]

    r = client.post(
        f"/projects/{pid}/suggest-target-groups",
        headers={"Authorization": f"Bearer {token}"},
        json={"max_suggestions": 5, "include_project_research": False, "include_checkion_topics": False, "bilingual": False},
    )
    assert r.status_code == 200, r.text
    assert r.json()["suggestions"][0]["name"] == "A"
    mock_run.assert_not_called()


@patch("app.routers.projects.run_suggest_target_groups")
@patch("app.routers.projects.get_cache_entry")
def test_suggest_target_groups_force_refresh_bypasses_cache(mock_get_cache, mock_run):
    mock_get_cache.return_value = None
    mock_run.return_value = ([], {})
    token = _register_user()
    pr = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "P2", "company_context": "ctx"})
    assert pr.status_code == 201, pr.text
    pid = pr.json()["id"]

    r = client.post(
        f"/projects/{pid}/suggest-target-groups?force_refresh=1",
        headers={"Authorization": f"Bearer {token}"},
        json={"max_suggestions": 5, "include_project_research": False, "include_checkion_topics": False, "bilingual": False},
    )
    assert r.status_code == 200, r.text
    mock_run.assert_called()

