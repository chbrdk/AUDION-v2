from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Project, ProjectMember, ProjectMemberStatus, ProjectRole, User
from ..schemas import (
    ProjectCreateRequest,
    ProjectDetailResponse,
    ProjectListResponse,
    ProjectMemberAddRequest,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectUpdateRequest,
)
from ..services.auth import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])


def _get_project(session: Session, project_id: str) -> Project:
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project id") from exc
    project = session.get(Project, project_uuid)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _get_membership(session: Session, *, project_id: UUID, user_id: UUID) -> ProjectMember | None:
    return session.scalar(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
        .where(ProjectMember.user_id == user_id)
        .where(ProjectMember.status == ProjectMemberStatus.active)
    )


def _require_member(session: Session, *, project_id: UUID, user_id: UUID) -> ProjectMember:
    membership = _get_membership(session, project_id=project_id, user_id=user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project access denied")
    return membership


def _require_admin_or_owner(membership: ProjectMember) -> None:
    if membership.role not in {ProjectRole.owner, ProjectRole.admin}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


def _project_response(project: Project) -> ProjectResponse:
    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        owner_user_id=str(project.owner_user_id),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def _member_response(member: ProjectMember, user: User) -> ProjectMemberResponse:
    return ProjectMemberResponse(
        id=str(member.id),
        user_id=str(user.id),
        email=user.email,
        name=user.name,
        role=member.role.value,
        status=member.status.value,
        created_at=member.created_at,
    )


@router.get("", response_model=ProjectListResponse)
def list_projects(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProjectListResponse:
    projects = session.scalars(
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == current_user.id)
        .where(ProjectMember.status == ProjectMemberStatus.active)
        .order_by(Project.created_at.desc())
    ).all()
    items = [_project_response(project) for project in projects]
    return ProjectListResponse(items=items, total=len(items))


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProjectResponse:
    project = Project(
        id=uuid4(),
        name=payload.name.strip(),
        owner_user_id=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(project)
    session.flush()

    membership = ProjectMember(
        id=uuid4(),
        project_id=project.id,
        user_id=current_user.id,
        role=ProjectRole.owner,
        status=ProjectMemberStatus.active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(membership)
    session.commit()

    return _project_response(project)


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProjectDetailResponse:
    project = _get_project(session, project_id)
    _require_member(session, project_id=project.id, user_id=current_user.id)

    members = session.scalars(
        select(ProjectMember)
        .where(ProjectMember.project_id == project.id)
        .order_by(ProjectMember.created_at.asc())
    ).all()
    users = {
        user.id: user
        for user in session.scalars(select(User).where(User.id.in_([m.user_id for m in members]))).all()
    }
    member_responses = [
        _member_response(member, users[member.user_id])
        for member in members
        if member.user_id in users
    ]

    return ProjectDetailResponse(**_project_response(project).model_dump(), members=member_responses)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    payload: ProjectUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProjectResponse:
    project = _get_project(session, project_id)
    membership = _require_member(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    if payload.name is not None:
        project.name = payload.name.strip()
    project.updated_at = datetime.utcnow()
    session.commit()

    return _project_response(project)


@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=status.HTTP_201_CREATED)
def add_member(
    project_id: str,
    payload: ProjectMemberAddRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProjectMemberResponse:
    project = _get_project(session, project_id)
    membership = _require_member(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    email = payload.email.strip().lower()
    user = session.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    role_value = payload.role or ProjectRole.member.value
    try:
        role = ProjectRole(role_value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role") from exc

    existing = session.scalar(
        select(ProjectMember)
        .where(ProjectMember.project_id == project.id)
        .where(ProjectMember.user_id == user.id)
    )
    if existing:
        existing.role = role
        existing.status = ProjectMemberStatus.active
        existing.updated_at = datetime.utcnow()
        session.commit()
        return _member_response(existing, user)

    new_member = ProjectMember(
        id=uuid4(),
        project_id=project.id,
        user_id=user.id,
        role=role,
        status=ProjectMemberStatus.active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(new_member)
    session.commit()
    return _member_response(new_member, user)


@router.delete("/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    project = _get_project(session, project_id)
    membership = _require_member(session, project_id=project.id, user_id=current_user.id)
    _require_admin_or_owner(membership)

    try:
        member_uuid = UUID(member_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid member id") from exc

    member = session.get(ProjectMember, member_uuid)
    if not member or member.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if member.role == ProjectRole.owner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owner cannot be removed")

    session.delete(member)
    session.commit()
