"""GET /projects/{id}/integrations/checkion/site-topics — auth + mocked bundle."""

from __future__ import annotations

import os
from unittest.mock import patch
from uuid import uuid4

import importlib.util

import pytest

if importlib.util.find_spec("fastapi") is None:
    pytest.skip("fastapi not installed in this environment (run with project venv/uv)", allow_module_level=True)

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_checkion_site_topics.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-checkion-site-topics")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("OPENAI_API_KEY", "test-openai")
os.environ.setdefault("DATA_DIR", "/tmp/audion-test-uploads-checkion-topics")

from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.db import engine  # noqa: E402

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def _register_user() -> str:
    email = f"chk_topics_{uuid4().hex[:12]}@example.com"
    r = client.post(
        "/auth/register",
        json={"email": email, "password": "test-password-123", "name": "Topics Tester"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@patch("app.routers.projects.fetch_checkion_site_topics_bundle")
def test_site_topics_returns_topics_when_bundle_ok(mock_bundle):
    mock_bundle.return_value = {
        "scan_id": "scan-1",
        "source": "checkion_project",
        "topics": [{"tag": "news", "page_count": 2, "weight_sum": 2.0, "median_score": 0.5}],
        "pages_processed": 5,
        "truncated": False,
        "seed_url_used": "https://example.com",
        "unavailable_reason": None,
    }
    token = _register_user()
    pr = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "TTopics"})
    assert pr.status_code == 201, pr.text
    pid = pr.json()["id"]

    r = client.get(
        f"/projects/{pid}/integrations/checkion/site-topics",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["scan_id"] == "scan-1"
    assert data["source"] == "checkion_project"
    assert data["topics"][0]["tag"] == "news"
    assert data["pages_processed"] == 5
    assert data["truncated"] is False
    assert data["seed_url_used"] == "https://example.com"
    assert data["unavailable_reason"] is None


@patch("app.routers.projects.fetch_checkion_site_topics_bundle")
def test_site_topics_propagates_unavailable_reason(mock_bundle):
    mock_bundle.return_value = {
        "scan_id": None,
        "source": None,
        "topics": [],
        "pages_processed": 0,
        "truncated": False,
        "seed_url_used": None,
        "unavailable_reason": "checkion_not_configured",
    }
    token = _register_user()
    pr = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "T2"})
    assert pr.status_code == 201, pr.text
    pid = pr.json()["id"]

    r = client.get(
        f"/projects/{pid}/integrations/checkion/site-topics",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["unavailable_reason"] == "checkion_not_configured"
