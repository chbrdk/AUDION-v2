from __future__ import annotations

import os
from datetime import datetime
from uuid import uuid4

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_platform_project_provisioning.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-platform-project-provisioning")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("PLEXON_SERVICE_SECRET", "test-secret")

from app.core.plexon_contract import (
    PLEXON_CONTRACT_VERSION_HEADER,
    PLEXON_FEDERATION_CONTRACT_VERSION,
    PLEXON_SERVICE_SECRET_HEADER,
)
from app.db import engine, get_session
from app.main import app
from app.models import Base, User
from app.services.auth import hash_password

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def _headers() -> dict[str, str]:
    return {
        PLEXON_SERVICE_SECRET_HEADER: "test-secret",
        PLEXON_CONTRACT_VERSION_HEADER: PLEXON_FEDERATION_CONTRACT_VERSION,
        "Content-Type": "application/json",
    }


def _provision_user(plexon_user_id: str) -> None:
    with get_session() as session:
        session.add(
            User(
                id=uuid4(),
                email=f"{plexon_user_id}@example.com",
                password_hash=hash_password("x"),
                name="Owner",
                plexon_user_id=plexon_user_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )
        session.commit()


def test_platform_project_upsert_requires_auth():
    response = client.put(
        "/platform/provisioning/projects/pp-1",
        json={},
    )
    assert response.status_code == 401


def test_platform_project_upsert_requires_provisioned_owner():
    platform_id = f"pp-{uuid4().hex[:12]}"
    response = client.put(
        f"/platform/provisioning/projects/{platform_id}",
        headers=_headers(),
        json={
            "platformCompanyId": "c1",
            "name": "Proj",
            "status": "active",
            "ownerUserId": "missing-user",
            "contractVersion": PLEXON_FEDERATION_CONTRACT_VERSION,
            "source": "test",
            "requestedAt": datetime.utcnow().isoformat(),
        },
    )
    assert response.status_code == 400


def test_platform_project_upsert_creates_mirror():
    owner_plexon = f"plexon-{uuid4().hex[:12]}"
    _provision_user(owner_plexon)
    platform_id = f"pp-{uuid4().hex[:12]}"
    response = client.put(
        f"/platform/provisioning/projects/{platform_id}",
        headers=_headers(),
        json={
            "platformCompanyId": "c1",
            "name": "Proj",
            "domain": "example.com",
            "status": "active",
            "ownerUserId": owner_plexon,
            "contractVersion": PLEXON_FEDERATION_CONTRACT_VERSION,
            "source": "test",
            "requestedAt": datetime.utcnow().isoformat(),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "applied"
    assert body["externalProjectId"]


def test_platform_project_summary_requires_plexon_user_header():
    platform_id = f"pp-{uuid4().hex[:12]}"
    response = client.get(
        f"/platform/provisioning/projects/{platform_id}",
        headers=_headers(),
    )
    assert response.status_code == 400
