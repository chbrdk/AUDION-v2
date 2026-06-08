"""PUT /integrations/checkion/projects/{id}/link — CHECKION inbound service token."""

from __future__ import annotations

import importlib.util
import os
from uuid import uuid4

import pytest

if importlib.util.find_spec("fastapi") is None:
    pytest.skip("fastapi not installed in this environment (run with project venv/uv)", allow_module_level=True)

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_checkion_audience_link.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-checkion-audience-link")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("OPENAI_API_KEY", "test-openai")
os.environ.setdefault("DATA_DIR", "/tmp/audion-test-uploads-checkion-link")
os.environ["CHECKION_INBOUND_SERVICE_TOKEN"] = "test-checkion-inbound-token"

from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.db import engine  # noqa: E402

Base.metadata.create_all(bind=engine)
client = TestClient(app)

SERVICE_HEADERS = {"Authorization": "Bearer test-checkion-inbound-token"}


def _create_audion_project(name: str = "Link Target") -> str:
    email = f"chk_link_{uuid4().hex[:12]}@example.com"
    r = client.post(
        "/auth/register",
        json={"email": email, "password": "test-password-123", "name": "Link Tester"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    pr = client.post(
        "/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": name},
    )
    assert pr.status_code == 201, pr.text
    return pr.json()["id"]


def test_link_checkion_project_to_audion_project():
    audion_id = _create_audion_project()
    checkion_id = str(uuid4())

    r = client.put(
        f"/integrations/checkion/projects/{checkion_id}/link",
        headers=SERVICE_HEADERS,
        json={"audion_project_id": audion_id},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["audionProjectId"] == audion_id
    assert body["checkionProjectId"] == checkion_id


def test_link_rejects_missing_service_token():
    audion_id = _create_audion_project("No Token")
    checkion_id = str(uuid4())

    r = client.put(
        f"/integrations/checkion/projects/{checkion_id}/link",
        json={"audion_project_id": audion_id},
    )
    assert r.status_code == 401


def test_list_audion_projects_for_checkion_link():
    _create_audion_project("Listed Project")

    r = client.get("/integrations/checkion/audion-projects", headers=SERVICE_HEADERS)
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert isinstance(items, list)
    assert any(item["name"] == "Listed Project" for item in items)
