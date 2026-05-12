from __future__ import annotations

import os
from datetime import datetime
from uuid import uuid4

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_platform_provisioning.db")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-platform-provisioning")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("PLEXON_SERVICE_SECRET", "test-secret")

from app.core.plexon_contract import (
    PLEXON_CONTRACT_VERSION_HEADER,
    PLEXON_FEDERATION_CONTRACT_VERSION,
    PLEXON_SERVICE_SECRET_HEADER,
)
from app.db import engine, get_session
from app.main import app
from app.models import ApiToken, Base, PlatformManagedProjectMembership, Project, ProjectMember, User
from app.services.api_tokens import hash_token

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def _headers() -> dict[str, str]:
    return {
        PLEXON_SERVICE_SECRET_HEADER: "test-secret",
        PLEXON_CONTRACT_VERSION_HEADER: PLEXON_FEDERATION_CONTRACT_VERSION,
        "Content-Type": "application/json",
    }


def test_platform_provisioning_requires_service_secret():
    response = client.put(
        "/platform/provisioning/users/plexon-user-1",
        json={},
    )
    assert response.status_code == 401


def test_platform_provisioning_creates_local_user():
    user_id = f"plexon-{uuid4().hex[:12]}"
    response = client.put(
        f"/platform/provisioning/users/{user_id}",
        headers=_headers(),
        json={
            "userId": user_id,
            "email": f"{user_id}@example.com",
            "name": "Provisioned User",
            "company": "Acme",
            "avatarUrl": "https://example.com/avatar.png",
            "locale": "de",
            "desiredState": "granted",
            "platformRole": "member",
            "defaultContext": None,
            "contractVersion": PLEXON_FEDERATION_CONTRACT_VERSION,
            "source": "plexon-admin-sync",
            "requestedAt": "2026-05-12T20:00:00.000Z",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "applied"
    assert body["externalUserRef"]

    with get_session() as session:
        user = session.query(User).filter(User.plexon_user_id == user_id).one_or_none()
        assert user is not None
        assert user.email == f"{user_id}@example.com"
        assert user.name == "Provisioned User"


def test_platform_provisioning_disables_existing_user_and_revokes_tokens():
    user = User(
        id=uuid4(),
        email=f"disabled_{uuid4().hex[:10]}@example.com",
        password_hash="hash",
        name="Disabled User",
        plexon_user_id=f"plexon-{uuid4().hex[:10]}",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    token = ApiToken(
        id=uuid4(),
        user_id=user.id,
        token_hash=hash_token("audion_" + "1" * 64),
        created_at=datetime.utcnow(),
    )
    with get_session() as session:
        session.add(user)
        session.flush()
        token.user_id = user.id
        session.add(token)
        session.commit()

    response = client.put(
        f"/platform/provisioning/users/{user.plexon_user_id}",
        headers=_headers(),
        json={
            "userId": user.plexon_user_id,
            "email": user.email,
            "desiredState": "disabled",
            "platformRole": "member",
            "defaultContext": None,
            "contractVersion": PLEXON_FEDERATION_CONTRACT_VERSION,
            "source": "plexon-admin-sync",
            "requestedAt": "2026-05-12T20:00:00.000Z",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "disabled"

    with get_session() as session:
        token_count = session.query(ApiToken).filter(ApiToken.user_id == user.id).count()
        assert token_count == 0


def test_platform_provisioning_materializes_project_memberships():
    owner = User(
        id=uuid4(),
        email=f"owner_{uuid4().hex[:10]}@example.com",
        password_hash="hash",
        name="Owner",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    provisioned_project = Project(
        id=uuid4(),
        name="Mapped Project",
        owner_user_id=owner.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    with get_session() as session:
        session.add(owner)
        session.flush()
        provisioned_project.owner_user_id = owner.id
        session.add(provisioned_project)
        session.commit()

    user_id = f"plexon-{uuid4().hex[:12]}"
    response = client.put(
        f"/platform/provisioning/users/{user_id}",
        headers=_headers(),
        json={
            "userId": user_id,
            "email": f"{user_id}@example.com",
            "name": "Provisioned Member",
            "desiredState": "granted",
            "platformRole": "member",
            "defaultContext": None,
            "projectAssignments": [
                {
                    "projectId": str(provisioned_project.id),
                    "role": "admin",
                }
            ],
            "contractVersion": PLEXON_FEDERATION_CONTRACT_VERSION,
            "source": "plexon-admin-sync",
            "requestedAt": "2026-05-12T20:00:00.000Z",
        },
    )

    assert response.status_code == 200, response.text
    with get_session() as session:
        user = session.query(User).filter(User.plexon_user_id == user_id).one()
        membership = session.query(ProjectMember).filter(
            ProjectMember.user_id == user.id,
            ProjectMember.project_id == provisioned_project.id,
        ).one_or_none()
        tracked = session.query(PlatformManagedProjectMembership).filter(
            PlatformManagedProjectMembership.user_id == user.id,
            PlatformManagedProjectMembership.project_id == provisioned_project.id,
        ).one_or_none()
        assert membership is not None
        assert membership.role.value == "admin"
        assert tracked is not None
        assert tracked.role.value == "admin"
