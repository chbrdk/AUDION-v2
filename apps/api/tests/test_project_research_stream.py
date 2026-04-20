"""Project research SSE stream – smoke test with DB-stored events."""

from __future__ import annotations

import importlib.util
import os
from unittest.mock import patch
from uuid import UUID

import pytest

if importlib.util.find_spec("fastapi") is None:
    pytest.skip("fastapi not installed in this environment (run with project venv/uv)", allow_module_level=True)

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_project_research_stream.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-project-research-stream")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("OPENAI_API_KEY", "test-openai")
os.environ.setdefault("DATA_DIR", "/tmp/audion-test-uploads")

from app.main import app  # noqa: E402
from app.db import get_session, engine  # noqa: E402
from app.models import Base, ProjectResearchEvent, ProjectResearchRun, ProjectResearchRunStatus  # noqa: E402

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def _register_user() -> str:
    r = client.post("/auth/register", json={"email": "sse@example.com", "password": "pw12345678", "name": "SSE"})
    # If the test DB persists between runs, user may already exist. In that case, login.
    if r.status_code != 200:
        r = client.post("/auth/login", json={"email": "sse@example.com", "password": "pw12345678"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@patch("app.routers.projects.celery_app.send_task")
def test_project_research_stream_sends_progress_and_done(_mock_send_task):
    token = _register_user()
    pr = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "P"})
    assert pr.status_code == 201, pr.text
    pid = pr.json()["id"]

    sr = client.post(
        f"/projects/{pid}/research/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"seed_url": "https://example.com"},
    )
    assert sr.status_code == 200, sr.text
    run_id = sr.json()["run_id"]

    with get_session() as session:
        run = session.get(ProjectResearchRun, UUID(run_id))
        assert run
        session.add(
            ProjectResearchEvent(
                run_id=run.id,
                event_type="crawl_start",
                message="Starting website crawl.",
                payload={"seed_url": "https://example.com"},
            )
        )
        run.status = ProjectResearchRunStatus.succeeded
        session.commit()

    # Stream and assert we receive at least one progress event and a done event.
    with client.stream(
        "GET",
        f"/projects/{pid}/research/stream?run_id={run_id}",
        headers={"Authorization": f"Bearer {token}"},
    ) as r:
        assert r.status_code == 200, r.text
        body = ""
        for line in r.iter_lines():
            if not line:
                continue
            body += line + "\n"
            if "event: done" in body:
                break

        assert "event: progress" in body
        assert "crawl_start" in body
        assert "event: done" in body

