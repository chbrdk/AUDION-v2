from __future__ import annotations

import base64
import hashlib
import hmac
from datetime import datetime
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..db import get_db
from ..models import Project, ProjectMember, ProjectMemberStatus, ProjectRole, User
from ..schemas import (
    AuthLoginRequest,
    AuthMeResponse,
    AuthPasswordUpdateRequest,
    AuthPlexonSyncRequest,
    AuthProfileUpdateRequest,
    AuthRegisterRequest,
    AuthTokenResponse,
    UserResponse,
)
from ..services.auth import create_access_token, get_current_user, hash_password, verify_password

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        company=user.company,
        avatar_url=user.avatar_url,
        locale=user.locale,
        plexon_user_id=user.plexon_user_id,
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


def _plexon_derived_password(secret: str, plexon_user_id: str) -> str:
    """Same derivation as AUDION web (Node): HMAC-SHA256(secret, user_id), base64url, first 32 chars."""
    raw = hmac.new(secret.encode(), plexon_user_id.encode(), hashlib.sha256).digest()
    b64 = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    return b64[:32]


@router.post("/plexon-sync", response_model=AuthTokenResponse)
def plexon_sync(
    payload: AuthPlexonSyncRequest,
    x_service_secret: str | None = Header(default=None, alias="X-Service-Secret"),
    session: Session = Depends(get_db),
) -> AuthTokenResponse:
    """
    Link an existing AUDION user to PLEXON: set password to PLEXON-derived value.
    Called by AUDION web when register returns 409 (email already registered).
    Requires X-Service-Secret header matching PLEXON_SERVICE_SECRET.
    """
    settings = get_settings()
    secret = settings.plexon_service_secret
    if not secret or not x_service_secret or not hmac.compare_digest(secret, x_service_secret):
        logger.info("auth.plexon_sync", outcome="invalid_or_missing_service_secret")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing service secret")

    email = _normalize_email(payload.email)
    user = session.scalar(select(User).where(User.email == email))
    if not user:
        logger.info(
            "auth.plexon_sync",
            outcome="user_not_found",
            email_suffix=email.split("@")[-1] if "@" in email else "",
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    derived = _plexon_derived_password(secret, payload.plexon_user_id)
    user.password_hash = hash_password(derived)
    user.plexon_user_id = payload.plexon_user_id
    if payload.name is not None:
        user.name = payload.name.strip() or None
    user.updated_at = datetime.utcnow()
    session.commit()

    token = create_access_token(user=user)
    logger.info("auth.plexon_sync", outcome="ok", user_id=str(user.id))
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=_user_response(user),
        default_project_id=_default_project_id(session, user.id),
    )


@router.post("/register", response_model=AuthTokenResponse)
def register(payload: AuthRegisterRequest, session: Session = Depends(get_db)) -> AuthTokenResponse:
    email = _normalize_email(payload.email)
    existing = session.scalar(select(User).where(User.email == email))
    if existing:
        logger.info("auth.register", outcome="email_conflict", has_plexon_id=payload.plexon_user_id is not None)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        id=uuid4(),
        email=email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        plexon_user_id=payload.plexon_user_id,
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
    logger.info("auth.register", outcome="ok", user_id=str(user.id), has_plexon_id=payload.plexon_user_id is not None)
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
        logger.info(
            "auth.login",
            outcome="invalid_credentials",
            user_found=bool(user),
            has_plexon_id=bool(user and user.plexon_user_id),
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user.last_login_at = datetime.utcnow()
    session.commit()

    token = create_access_token(user=user)
    logger.info("auth.login", outcome="ok", user_id=str(user.id), has_plexon_id=bool(user.plexon_user_id))
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


@router.patch("/me", response_model=AuthMeResponse)
def update_me(
    payload: AuthProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> AuthMeResponse:
    if payload.email is not None:
        email = _normalize_email(payload.email)
        if email and email != current_user.email:
            existing = session.scalar(select(User).where(User.email == email))
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
            current_user.email = email

    if payload.name is not None:
        name = payload.name.strip()
        current_user.name = name or None

    if payload.company is not None:
        company = payload.company.strip()
        current_user.company = company or None

    if payload.avatar_url is not None:
        current_user.avatar_url = str(payload.avatar_url) if payload.avatar_url else None

    if payload.locale is not None:
        current_user.locale = payload.locale

    current_user.updated_at = datetime.utcnow()
    session.commit()

    return AuthMeResponse(
        user=_user_response(current_user),
        default_project_id=_default_project_id(session, current_user.id),
    )


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def update_password(
    payload: AuthPasswordUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid current password")

    current_user.password_hash = hash_password(payload.new_password)
    current_user.updated_at = datetime.utcnow()
    session.commit()
