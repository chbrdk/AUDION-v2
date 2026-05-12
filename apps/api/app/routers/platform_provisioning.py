from __future__ import annotations

import base64
import hashlib
import hmac
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.plexon_contract import (
    PLEXON_CONTRACT_VERSION_HEADER,
    PLEXON_FEDERATION_CONTRACT_VERSION,
    PLEXON_SERVICE_SECRET_HEADER,
)
from ..db import get_db
from ..models import ApiToken, User
from ..services.auth import hash_password

router = APIRouter(prefix="/platform/provisioning", tags=["platform-provisioning"])


class ProvisioningDefaultContext(BaseModel):
    entryPointId: str | None = None
    projectId: str | None = None
    deepLink: str | None = None


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
        session.commit()
        return {
            "status": "applied",
            "externalUserRef": str(user.id),
            "details": "Local AUDION user created and linked to PLEXON.",
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

    if not changed:
        return {
            "status": "no_change",
            "externalUserRef": str(user.id),
            "details": "Local AUDION user already matches the provisioning payload.",
        }

    user.updated_at = now
    session.commit()
    return {
        "status": "applied",
        "externalUserRef": str(user.id),
        "details": "Local AUDION user updated from PLEXON.",
    }
