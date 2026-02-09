from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Project, ProjectMember, ProjectMemberStatus, ProjectRole, User
from ..schemas import AuthLoginRequest, AuthMeResponse, AuthRegisterRequest, AuthTokenResponse, UserResponse
from ..services.auth import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        created_at=user.created_at,
    )


def _default_project_id(session: Session, user_id: UUID) -> str | None:
    project_id = session.scalar(
        select(ProjectMember.project_id)
        .where(ProjectMember.user_id == user_id)
        .where(ProjectMember.status == ProjectMemberStatus.active)
        .order_by(ProjectMember.created_at.asc())
    )
    return str(project_id) if project_id else None


@router.post("/register", response_model=AuthTokenResponse)
def register(payload: AuthRegisterRequest, session: Session = Depends(get_db)) -> AuthTokenResponse:
    email = _normalize_email(payload.email)
    existing = session.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        id=uuid4(),
        email=email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(user)
    session.flush()

    project = Project(
        id=uuid4(),
        name="My First Project",
        owner_user_id=user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(project)
    session.flush()

    membership = ProjectMember(
        id=uuid4(),
        project_id=project.id,
        user_id=user.id,
        role=ProjectRole.owner,
        status=ProjectMemberStatus.active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(membership)
    session.commit()

    token = create_access_token(user=user)
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=_user_response(user),
        default_project_id=str(project.id),
    )


@router.post("/login", response_model=AuthTokenResponse)
def login(payload: AuthLoginRequest, session: Session = Depends(get_db)) -> AuthTokenResponse:
    email = _normalize_email(payload.email)
    user = session.scalar(select(User).where(User.email == email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user.last_login_at = datetime.utcnow()
    session.commit()

    token = create_access_token(user=user)
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=_user_response(user),
        default_project_id=_default_project_id(session, user.id),
    )


@router.get("/me", response_model=AuthMeResponse)
def me(current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> AuthMeResponse:
    return AuthMeResponse(
        user=_user_response(current_user),
        default_project_id=_default_project_id(session, current_user.id),
    )
