from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ProjectMember, ProjectMemberStatus


def list_accessible_project_ids(session: Session, user_id: UUID) -> list[UUID]:
    rows = session.scalars(
        select(ProjectMember.project_id)
        .where(ProjectMember.user_id == user_id)
        .where(ProjectMember.status == ProjectMemberStatus.active)
    ).all()
    return list(rows)


def ensure_project_access(session: Session, *, user_id: UUID, project_id: UUID) -> None:
    exists = session.scalar(
        select(ProjectMember.id)
        .where(ProjectMember.user_id == user_id)
        .where(ProjectMember.project_id == project_id)
        .where(ProjectMember.status == ProjectMemberStatus.active)
    )
    if not exists:
        raise PermissionError("project_access_denied")
