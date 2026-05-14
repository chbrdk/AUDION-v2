"""POST /projects/{id}/plexon-mirror — retry PLEXON registration."""

from __future__ import annotations

import importlib.util
import os
from unittest.mock import patch
import pytest

if importlib.util.find_spec("fastapi") is None:
    pytest.skip("fastapi not installed in this environment (run with project venv/uv)", allow_module_level=True)

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_project_plexon_mirror_retry.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-plexon-mirror-retry")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("OPENAI_API_KEY", "test-openai")
os.environ.setdefault("DATA_DIR", "/tmp/audion-test-uploads")

from app.main import app  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.db import engine, get_session  # noqa: E402
from app.models import Base, Project, ProjectMember, ProjectMemberStatus, ProjectRole, User  # noqa: E402

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def _register_user(email: str) -> str:
    r = client.post("/auth/register", json={"email": email, "password": "pw12345678", "name": "T"})
    if r.status_code != 200:
        r = client.post("/auth/login", json={"email": email, "password": "pw12345678"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_plexon_mirror_retry_requires_platform_company():
    token = _register_user("retry-no-co@example.com")
    r = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "P1"})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    r2 = client.post(
        f"/projects/{pid}/plexon-mirror",
        headers={"Authorization": f"Bearer {token}"},
        json={},
    )
    assert r2.status_code == 400, r2.text
    assert "platform_company_id" in str(r2.json().get("detail", "")).lower()


def test_plexon_mirror_retry_already_synced():
    token = _register_user("retry-synced@example.com")
    with get_session() as session:
        u = session.query(User).filter(User.email == "retry-synced@example.com").one()
        p = Project(
            name="Synced",
            owner_user_id=u.id,
            platform_company_id="co-1",
            platform_project_id="pp-existing",
        )
        session.add(p)
        session.flush()
        session.add(
            ProjectMember(
                project_id=p.id,
                user_id=u.id,
                role=ProjectRole.owner,
                status=ProjectMemberStatus.active,
            )
        )
        session.commit()
        pid = str(p.id)

    r = client.post(
        f"/projects/{pid}/plexon-mirror",
        headers={"Authorization": f"Bearer {token}"},
        json={},
    )
    assert r.status_code == 200, r.text
    assert r.json().get("plexon_mirror_status") == "already_synced"


@patch("app.routers.projects.register_audion_project_on_plexon")
def test_plexon_mirror_retry_calls_plexon(mock_register):
    with patch.dict(
        os.environ,
        {
            "PLEXON_API_BASE_URL": "https://plexon.test",
            "PLEXON_SERVICE_SECRET": "secret-x",
        },
    ):
        get_settings.cache_clear()
        token = _register_user("retry-call@example.com")
        with get_session() as session:
            u = session.query(User).filter(User.email == "retry-call@example.com").one()
            u.plexon_user_id = "plexon-owner-retry"
            p = Project(name="Retry me", owner_user_id=u.id, platform_company_id="co-retry")
            session.add(p)
            session.flush()
            session.add(
                ProjectMember(
                    project_id=p.id,
                    user_id=u.id,
                    role=ProjectRole.owner,
                    status=ProjectMemberStatus.active,
                )
            )
            session.commit()
            pid = str(p.id)

        mock_register.return_value = {
            "platformProjectId": "pp-new",
            "checkionProjectId": "chk-new",
            "platformCompanyId": "co-retry",
        }

        r = client.post(
            f"/projects/{pid}/plexon-mirror",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["platform_project_id"] == "pp-new"
        assert body.get("plexon_mirror_status") == "completed"
        mock_register.assert_called_once()
        assert mock_register.call_args.kwargs["audion_project_id"] == pid
    get_settings.cache_clear()


@patch("app.routers.projects.register_audion_project_on_plexon")
@patch("app.routers.projects.fetch_plexon_default_platform_company_id_for_user")
def test_plexon_mirror_retry_resolves_company_from_plexon_profile(mock_fetch, mock_register):
    mock_fetch.return_value = "co-from-profile"
    mock_register.return_value = {
        "platformProjectId": "pp-prof",
        "checkionProjectId": None,
        "platformCompanyId": "co-from-profile",
    }
    with patch.dict(
        os.environ,
        {
            "PLEXON_API_BASE_URL": "https://plexon.test",
            "PLEXON_SERVICE_SECRET": "secret-x",
        },
    ):
        get_settings.cache_clear()
        token = _register_user("retry-profile-co@example.com")
        with get_session() as session:
            u = session.query(User).filter(User.email == "retry-profile-co@example.com").one()
            u.plexon_user_id = "plexon-profile-user"
            p = Project(name="No co on row", owner_user_id=u.id, platform_company_id=None)
            session.add(p)
            session.flush()
            session.add(
                ProjectMember(
                    project_id=p.id,
                    user_id=u.id,
                    role=ProjectRole.owner,
                    status=ProjectMemberStatus.active,
                )
            )
            session.commit()
            pid = str(p.id)

        r = client.post(
            f"/projects/{pid}/plexon-mirror",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert r.status_code == 200, r.text
        mock_fetch.assert_called_once()
        mock_register.assert_called_once()
        assert mock_register.call_args.kwargs["platform_company_id"] == "co-from-profile"
        body = r.json()
        assert body.get("platform_project_id") == "pp-prof"
        assert body.get("platform_company_id") == "co-from-profile"
    get_settings.cache_clear()


@patch("app.routers.projects.register_audion_project_on_plexon")
@patch("app.routers.projects.fetch_plexon_default_platform_company_id_for_user")
def test_create_project_resolves_platform_company_from_profile(mock_fetch, mock_register):
    mock_fetch.return_value = "co-create"
    mock_register.return_value = {
        "platformProjectId": "pp-create",
        "checkionProjectId": None,
        "platformCompanyId": "co-create",
    }
    with patch.dict(
        os.environ,
        {
            "PLEXON_API_BASE_URL": "https://plexon.test",
            "PLEXON_SERVICE_SECRET": "secret-x",
        },
    ):
        get_settings.cache_clear()
        token = _register_user("create-prof@example.com")
        with get_session() as session:
            u = session.query(User).filter(User.email == "create-prof@example.com").one()
            u.plexon_user_id = "plexon-create"
            session.commit()

        r = client.post(
            "/projects",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "From profile"},
        )
        assert r.status_code == 201, r.text
        mock_fetch.assert_called_once()
        mock_register.assert_called_once()
        assert mock_register.call_args.kwargs["platform_company_id"] == "co-create"
        body = r.json()
        assert body.get("platform_company_id") == "co-create"
        assert body.get("platform_project_id") == "pp-create"
    get_settings.cache_clear()
