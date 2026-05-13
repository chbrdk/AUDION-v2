"""POST /projects — PLEXON central registration after create."""

from __future__ import annotations

import importlib.util
import os
from unittest.mock import patch
from uuid import UUID

import pytest

if importlib.util.find_spec("fastapi") is None:
    pytest.skip("fastapi not installed in this environment (run with project venv/uv)", allow_module_level=True)

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_project_plexon_origin.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-project-plexon-origin")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("OPENAI_API_KEY", "test-openai")
os.environ.setdefault("DATA_DIR", "/tmp/audion-test-uploads")

from app.main import app  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.db import engine, get_session  # noqa: E402
from app.models import Base, Project, User  # noqa: E402

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def _register_user(email: str) -> str:
    r = client.post("/auth/register", json={"email": email, "password": "pw12345678", "name": "T"})
    if r.status_code != 200:
        r = client.post("/auth/login", json={"email": email, "password": "pw12345678"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_create_project_skips_plexon_when_not_configured():
    token = _register_user("skip-plexon@example.com")
    r = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Local only"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body.get("platform_project_id") in (None, "")


@patch("app.routers.projects.register_audion_project_on_plexon")
def test_create_project_requires_platform_company_when_plexon_linked(mock_register):
    with patch.dict(
        os.environ,
        {
            "PLEXON_API_BASE_URL": "https://plexon.test",
            "PLEXON_SERVICE_SECRET": "secret-x",
        },
    ):
        get_settings.cache_clear()
        token = _register_user("needs-company@example.com")
        with get_session() as session:
            user = session.query(User).filter(User.email == "needs-company@example.com").one()
            user.plexon_user_id = "plexon-user-99"
            session.commit()

        r = client.post(
            "/projects",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "No company id"},
        )
        assert r.status_code == 400, r.text
        assert "platform_company_id" in str(r.json().get("detail", "")).lower()
        mock_register.assert_not_called()
    get_settings.cache_clear()


@patch("app.routers.projects.register_audion_project_on_plexon")
def test_create_project_sets_platform_ids_after_plexon_ok(mock_register):
    with patch.dict(
        os.environ,
        {
            "PLEXON_API_BASE_URL": "https://plexon.test",
            "PLEXON_SERVICE_SECRET": "secret-x",
        },
    ):
        get_settings.cache_clear()
        token = _register_user("with-plexon@example.com")
        with get_session() as session:
            user = session.query(User).filter(User.email == "with-plexon@example.com").one()
            user.plexon_user_id = "plexon-owner-1"
            session.commit()

        mock_register.return_value = {
            "platformProjectId": "pp-abc",
            "checkionProjectId": "chk-xyz",
            "platformCompanyId": "comp-1",
        }

        r = client.post(
            "/projects",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Central", "platform_company_id": "comp-1"},
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["platform_project_id"] == "pp-abc"
        assert body["platform_company_id"] == "comp-1"
        assert body["checkion_project_id"] == "chk-xyz"
        mock_register.assert_called_once()
        call_kw = mock_register.call_args.kwargs
        assert call_kw["platform_company_id"] == "comp-1"
        assert call_kw["owner_plexon_user_id"] == "plexon-owner-1"
        assert UUID(call_kw["audion_project_id"])
        with get_session() as session:
            proj = session.query(Project).filter(Project.name == "Central").one()
            assert proj.platform_project_id == "pp-abc"
    get_settings.cache_clear()
