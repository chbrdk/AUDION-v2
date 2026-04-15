"""Tests for POST /projects/bootstrap (AI easy setup)."""
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_project_bootstrap.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-bootstrap")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "test")
os.environ.setdefault("OPENAI_API_KEY", "test-openai")
os.environ.setdefault("DATA_DIR", "/tmp/audion-test-uploads")

from app.main import app
from app.models import Base, Project, TargetGroup
from app.db import engine, get_session
from app.services.suggest_target_groups import TargetGroupSuggestion

Base.metadata.create_all(bind=engine)

client = TestClient(app)


def _register_user() -> str:
    email = f"bootstrap_{uuid4().hex[:12]}@example.com"
    r = client.post(
        "/auth/register",
        json={"email": email, "password": "test-password-123", "name": "Bootstrap Tester"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@patch("app.routers.projects.generate_persona_for_target_group")
@patch("app.routers.projects.run_suggest_target_groups")
def test_project_bootstrap_creates_project_target_group_persona(mock_suggest, mock_gen_persona):
    mock_suggest.return_value = (
        [
            TargetGroupSuggestion(
                name="Primary buyers",
                segment="b2b-buyers",
                description="Key decision makers for the product.",
            )
        ],
        {"input_tokens": 1, "output_tokens": 2},
    )
    mock_pr = MagicMock()
    mock_pr.metadata.personaId = str(uuid4())
    mock_pr.profile.name = "Generated Name"
    mock_pr.profile.segment = "b2b-buyers"
    mock_gen_persona.return_value = mock_pr

    token = _register_user()
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/projects/bootstrap",
        headers=headers,
        json={
            "customer_name": "Acme",
            "about": "We sell widgets to mid-market teams.",
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["project"]["name"] == "Acme"
    assert data["target_group"]["name"] == "Primary buyers"
    assert data["target_group"]["segment"] == "b2b-buyers"
    assert data["persona"]["name"] == "Generated Name"
    assert data["website_excerpt_included"] is False

    pid = data["project"]["id"]
    with get_session() as session:
        proj = session.get(Project, UUID(pid))
        assert proj is not None
        assert "Acme" in (proj.description or "")
        tgs = session.query(TargetGroup).filter(TargetGroup.project_id == proj.id).all()
        assert len(tgs) == 1
        assert tgs[0].name == "Primary buyers"
        mock_gen_persona.assert_called_once()


@patch("app.routers.projects.fetch_website_plain_text")
@patch("app.routers.projects.generate_persona_for_target_group")
@patch("app.routers.projects.run_suggest_target_groups")
def test_project_bootstrap_merges_website_text(mock_suggest, mock_gen_persona, mock_fetch):
    mock_suggest.return_value = (
        [TargetGroupSuggestion(name="G1", segment="s1", description="d1")],
        {},
    )
    mock_pr = MagicMock()
    mock_pr.metadata.personaId = str(uuid4())
    mock_pr.profile.name = "N"
    mock_pr.profile.segment = "s1"
    mock_gen_persona.return_value = mock_pr
    mock_fetch.return_value = ("About us from page", None)

    token = _register_user()
    res = client.post(
        "/projects/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "customer_name": "Co",
            "about": "Context line",
            "website_url": "https://example.com/about",
        },
    )
    assert res.status_code == 201, res.text
    assert res.json()["website_excerpt_included"] is True
    pid = res.json()["project"]["id"]
    with get_session() as session:
        proj = session.get(Project, UUID(pid))
        assert proj is not None
        assert "About us from page" in (proj.company_context or "")
    mock_fetch.assert_called_once()


def test_project_bootstrap_rejects_bad_website_url():
    token = _register_user()
    res = client.post(
        "/projects/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "customer_name": "Co",
            "about": "X",
            "website_url": "ftp://evil.com/x",
        },
    )
    assert res.status_code == 400
