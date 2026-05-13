from __future__ import annotations

import base64
import hashlib
import hmac
from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.plexon_contract import (
    PLEXON_CONTRACT_VERSION_HEADER,
    PLEXON_FEDERATION_CONTRACT_VERSION,
    PLEXON_SERVICE_SECRET_HEADER,
)
from ..db import get_db
from ..models import (
    ApiToken,
    Persona,
    PlatformManagedProjectMembership,
    Project,
    ProjectMember,
    ProjectMemberStatus,
    ProjectRole,
    User,
)
from ..services.auth import hash_password
from ..services.ai_assist import seed_default_templates_for_project

router = APIRouter(prefix="/platform/provisioning", tags=["platform-provisioning"])

PLEXON_USER_ID_HEADER = "X-Plexon-User-Id"


class ProvisioningDefaultContext(BaseModel):
    entryPointId: str | None = None
    projectId: str | None = None
    deepLink: str | None = None


class ProvisioningProjectAssignment(BaseModel):
    projectId: str
    role: str


class ProvisioningRequest(BaseModel):
    userId: str
    email: EmailStr
    name: str | None = None
    company: str | None = None
    avatarUrl: str | None = None
    locale: str | None = None
    desiredState: str
    platformRole: str
    defaultContext: ProvisioningDefaultContext | None = None
    projectAssignments: list[ProvisioningProjectAssignment] = []
    contractVersion: str
    source: str
    requestedAt: str


def _normalize_optional(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _assert_provisioning_auth(
    *,
    x_service_secret: str | None,
    x_contract_version: str | None,
) -> None:
    settings = get_settings()
    secret = settings.plexon_service_secret
    if (
        not secret
        or not x_service_secret
        or not hmac.compare_digest(secret, x_service_secret)
        or x_contract_version != PLEXON_FEDERATION_CONTRACT_VERSION
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid provisioning credentials")


def _derived_local_password(secret: str, plexon_user_id: str) -> str:
    raw = hmac.new(secret.encode(), plexon_user_id.encode(), hashlib.sha256).digest()
    b64 = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    return b64[:32]


def _parse_project_assignment_role(value: str) -> ProjectRole:
    try:
        role = ProjectRole(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project assignment role") from exc
    if role == ProjectRole.owner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owner role is not supported for platform-managed memberships")
    return role


def _sync_platform_managed_memberships(
    session: Session,
    *,
    user: User,
    plexon_user_id: str,
    assignments: list[ProvisioningProjectAssignment],
) -> tuple[bool, str | None]:
    changed = False
    details: list[str] = []

    tracked_memberships = session.scalars(
        select(PlatformManagedProjectMembership).where(PlatformManagedProjectMembership.user_id == user.id)
    ).all()
    tracked_by_project_id = {str(item.project_id): item for item in tracked_memberships}
    requested_project_ids: set[str] = set()

    for assignment in assignments:
        project_id_raw = assignment.projectId.strip()
        try:
            project_uuid = UUID(project_id_raw)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid AUDION project id in project assignment") from exc

        project = session.get(Project, project_uuid)
        if not project:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AUDION project not found for project assignment")

        requested_project_ids.add(str(project.id))
        role = _parse_project_assignment_role(assignment.role)

        membership = session.scalar(
            select(ProjectMember)
            .where(ProjectMember.project_id == project.id)
            .where(ProjectMember.user_id == user.id)
        )
        if membership is None:
            membership = ProjectMember(
                id=uuid4(),
                project_id=project.id,
                user_id=user.id,
                role=role,
                status=ProjectMemberStatus.active,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(membership)
            changed = True
        else:
            if membership.role != ProjectRole.owner and (
                membership.role != role or membership.status != ProjectMemberStatus.active
            ):
                membership.role = role
                membership.status = ProjectMemberStatus.active
                membership.updated_at = datetime.utcnow()
                changed = True
            elif membership.role == ProjectRole.owner:
                details.append(f"Skipped owner membership for project {project_id_raw}")

        tracked = tracked_by_project_id.get(str(project.id))
        if tracked is None:
            session.add(
                PlatformManagedProjectMembership(
                    id=uuid4(),
                    plexon_user_id=plexon_user_id,
                    user_id=user.id,
                    project_id=project.id,
                    role=role,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
            )
            changed = True
        elif tracked.role != role or tracked.plexon_user_id != plexon_user_id:
            tracked.role = role
            tracked.plexon_user_id = plexon_user_id
            tracked.updated_at = datetime.utcnow()
            changed = True

    for tracked in tracked_memberships:
        tracked_project_id = str(tracked.project_id)
        if tracked_project_id in requested_project_ids:
            continue
        membership = session.scalar(
            select(ProjectMember)
            .where(ProjectMember.project_id == tracked.project_id)
            .where(ProjectMember.user_id == user.id)
        )
        if membership and membership.role != ProjectRole.owner:
            session.delete(membership)
            changed = True
        elif membership and membership.role == ProjectRole.owner:
            details.append(f"Kept owner membership for project {tracked_project_id}")
        session.delete(tracked)
        changed = True

    return changed, "; ".join(details) if details else None


@router.put("/users/{user_id}")
def provision_user(
    user_id: str,
    payload: ProvisioningRequest,
    x_service_secret: str | None = Header(default=None, alias=PLEXON_SERVICE_SECRET_HEADER),
    x_contract_version: str | None = Header(default=None, alias=PLEXON_CONTRACT_VERSION_HEADER),
    session: Session = Depends(get_db),
):
    _assert_provisioning_auth(
        x_service_secret=x_service_secret,
        x_contract_version=x_contract_version,
    )

    if payload.userId != user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path user id does not match payload userId")
    if payload.contractVersion != PLEXON_FEDERATION_CONTRACT_VERSION:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported provisioning contract version")
    if payload.desiredState not in {"granted", "disabled"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid desiredState")

    normalized_email = payload.email.strip().lower()
    existing_by_plexon = session.scalar(select(User).where(User.plexon_user_id == user_id).limit(1))
    existing_by_email = session.scalar(select(User).where(User.email == normalized_email).limit(1))

    if existing_by_email and existing_by_email.plexon_user_id and existing_by_email.plexon_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already linked to a different PLEXON user")

    user = existing_by_plexon or existing_by_email

    if payload.desiredState == "disabled":
        if user:
            session.query(ApiToken).filter(ApiToken.user_id == user.id).delete()
            _sync_platform_managed_memberships(
                session,
                user=user,
                plexon_user_id=user_id,
                assignments=[],
            )
            session.commit()
            return {
                "status": "disabled",
                "externalUserRef": str(user.id),
                "details": "Local API tokens revoked; memberships remain product-local.",
            }
        return {
            "status": "disabled",
            "externalUserRef": None,
            "details": "No local AUDION user found to disable.",
        }

    name = _normalize_optional(payload.name)
    company = _normalize_optional(payload.company)
    avatar_url = _normalize_optional(payload.avatarUrl)
    locale = _normalize_optional(payload.locale)
    now = datetime.utcnow()
    settings = get_settings()

    if user is None:
        user = User(
            id=uuid4(),
            email=normalized_email,
            password_hash=hash_password(_derived_local_password(settings.plexon_service_secret or "", user_id)),
            name=name,
            company=company,
            avatar_url=avatar_url,
            locale=locale,
            plexon_user_id=user_id,
            created_at=now,
            updated_at=now,
        )
        session.add(user)
        session.flush()
        assignments_changed, assignment_details = _sync_platform_managed_memberships(
            session,
            user=user,
            plexon_user_id=user_id,
            assignments=payload.projectAssignments,
        )
        session.commit()
        return {
            "status": "applied",
            "externalUserRef": str(user.id),
            "details": assignment_details or "Local AUDION user created and linked to PLEXON.",
        }

    changed = False
    if user.email != normalized_email:
        user.email = normalized_email
        changed = True
    if user.plexon_user_id != user_id:
        user.plexon_user_id = user_id
        changed = True
    if user.name != name:
        user.name = name
        changed = True
    if user.company != company:
        user.company = company
        changed = True
    if user.avatar_url != avatar_url:
        user.avatar_url = avatar_url
        changed = True
    if user.locale != locale:
        user.locale = locale
        changed = True

    assignments_changed, assignment_details = _sync_platform_managed_memberships(
        session,
        user=user,
        plexon_user_id=user_id,
        assignments=payload.projectAssignments,
    )

    if not changed and not assignments_changed:
        return {
            "status": "no_change",
            "externalUserRef": str(user.id),
            "details": assignment_details or "Local AUDION user already matches the provisioning payload.",
        }

    user.updated_at = now
    session.commit()
    return {
        "status": "applied",
        "externalUserRef": str(user.id),
        "details": assignment_details or "Local AUDION user updated from PLEXON.",
    }


class ProvisioningProjectUpsertRequest(BaseModel):
    platformCompanyId: str
    name: str
    domain: str | None = None
    status: str
    ownerUserId: str
    contractVersion: str
    source: str
    requestedAt: str


@router.put("/projects/{platform_project_id}")
def upsert_platform_project(
    platform_project_id: str,
    payload: ProvisioningProjectUpsertRequest,
    x_service_secret: str | None = Header(default=None, alias=PLEXON_SERVICE_SECRET_HEADER),
    x_contract_version: str | None = Header(default=None, alias=PLEXON_CONTRACT_VERSION_HEADER),
    session: Session = Depends(get_db),
):
    _assert_provisioning_auth(
        x_service_secret=x_service_secret,
        x_contract_version=x_contract_version,
    )
    if payload.contractVersion != PLEXON_FEDERATION_CONTRACT_VERSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported provisioning contract version",
        )
    ppid = platform_project_id.strip()
    if not ppid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid platform project id")

    owner = session.scalar(
        select(User).where(User.plexon_user_id == payload.ownerUserId.strip()).limit(1)
    )
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner must be provisioned in AUDION before platform project sync (user provisioning first).",
        )

    existing = session.scalar(select(Project).where(Project.platform_project_id == ppid).limit(1))
    now = datetime.utcnow()
    if existing:
        existing.name = payload.name.strip()
        existing.platform_company_id = payload.platformCompanyId.strip()
        if payload.status == "archived":
            existing.status = "archived"
        elif payload.status == "active" and existing.status == "archived":
            existing.status = "draft"
        if payload.domain and payload.domain.strip():
            line = f"Website: {payload.domain.strip()}"
            if not (existing.company_context or "").strip():
                existing.company_context = line
        existing.updated_at = now
        session.commit()
        return {
            "status": "applied",
            "externalProjectId": str(existing.id),
            "details": "AUDION project mirror updated.",
        }

    project = Project(
        id=uuid4(),
        name=payload.name.strip(),
        owner_user_id=owner.id,
        status="archived" if payload.status == "archived" else "draft",
        platform_project_id=ppid,
        platform_company_id=payload.platformCompanyId.strip(),
        created_at=now,
        updated_at=now,
    )
    if payload.domain and payload.domain.strip():
        project.company_context = f"Website: {payload.domain.strip()}"
    session.add(project)
    session.flush()
    session.add(
        ProjectMember(
            id=uuid4(),
            project_id=project.id,
            user_id=owner.id,
            role=ProjectRole.owner,
            status=ProjectMemberStatus.active,
            created_at=now,
            updated_at=now,
        )
    )
    seed_default_templates_for_project(session, str(project.id))
    session.commit()
    return {
        "status": "applied",
        "externalProjectId": str(project.id),
        "details": "AUDION project mirror created.",
    }


@router.get("/projects/{platform_project_id}")
def get_platform_project_summary(
    platform_project_id: str,
    x_service_secret: str | None = Header(default=None, alias=PLEXON_SERVICE_SECRET_HEADER),
    x_contract_version: str | None = Header(default=None, alias=PLEXON_CONTRACT_VERSION_HEADER),
    x_plexon_user_id: str | None = Header(default=None, alias=PLEXON_USER_ID_HEADER),
    session: Session = Depends(get_db),
):
    _assert_provisioning_auth(
        x_service_secret=x_service_secret,
        x_contract_version=x_contract_version,
    )
    puid = (x_plexon_user_id or "").strip()
    if not puid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{PLEXON_USER_ID_HEADER} is required",
        )
    ppid = platform_project_id.strip()
    if not ppid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid platform project id")

    project = session.scalar(select(Project).where(Project.platform_project_id == ppid).limit(1))
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform project mirror not found")

    viewer = session.scalar(select(User).where(User.plexon_user_id == puid).limit(1))
    if viewer is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unknown PLEXON user in AUDION")

    if project.owner_user_id != viewer.id:
        member = session.scalar(
            select(ProjectMember)
            .where(ProjectMember.project_id == project.id)
            .where(ProjectMember.user_id == viewer.id)
            .limit(1)
        )
        if member is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this project")

    persona_count = session.scalar(select(func.count(Persona.id)).where(Persona.project_id == project.id))
    return {
        "externalProjectId": str(project.id),
        "personaCount": int(persona_count or 0),
    }
