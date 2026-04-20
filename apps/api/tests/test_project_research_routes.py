"""Project research endpoints (start/status/latest) – smoke tests with mocked Celery."""

from __future__ import annotations

import os
from unittest.mock import patch
from uuid import uuid4

import importlib.util

import pytest

if importlib.util.find_spec("fastapi") is None:
    pytest.skip("fastapi not installed in this environment (run with project venv/uv)", allow_module_level=True)

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_project_research.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-project-research")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("OPENAI_API_KEY", "test-openai")
os.environ.setdefault("DATA_DIR", "/tmp/audion-test-uploads")

from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.db import engine  # noqa: E402

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def _register_user() -> str:
    email = f"research_{uuid4().hex[:12]}@example.com"
    r = client.post(
        "/auth/register",
        json={"email": email, "password": "test-password-123", "name": "Research Tester"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@patch("app.routers.projects.celery_app.send_task")
def test_project_research_start_requires_valid_url(mock_send_task):
    token = _register_user()
    # create project first (minimal)
    pr = client.post(
        "/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "P"},
    )
    assert pr.status_code == 201, pr.text
    pid = pr.json()["id"]

    r = client.post(
        f"/projects/{pid}/research/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"seed_url": "ftp://invalid"},
    )
    assert r.status_code == 400
    mock_send_task.assert_not_called()


