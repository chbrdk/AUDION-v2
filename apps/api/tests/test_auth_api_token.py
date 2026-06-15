"""Test get_current_user with Bearer API token (audion_xxx)."""
from __future__ import annotations

import os
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, ApiToken, User
from app.services.auth import get_current_user
from app.services import api_tokens as api_tokens_service


def build_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def test_get_current_user_with_api_token():
    """get_current_user accepts Bearer audion_<64hex> and returns the user."""
    session = build_session()
    user = User(
        id=uuid4(),
        email="tokenuser@example.com",
        password_hash="hash",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(user)
    session.flush()
    raw_token = api_tokens_service.generate_token_string()
    token_hash = api_tokens_service.hash_token(raw_token)
    session.add(
        ApiToken(
            id=uuid4(),
            user_id=user.id,
            token_hash=token_hash,
            created_at=datetime.utcnow(),
        )
    )
    session.commit()

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=raw_token)
    result = get_current_user(credentials=credentials, session=session)
    assert result.id == user.id
    assert result.email == user.email


def test_get_current_user_with_invalid_api_token_returns_401():
    """get_current_user with invalid API token raises 401."""
    session = build_session()
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="audion_" + "0" * 64,  # valid format but not in DB
    )
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=credentials, session=session)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid API token"


def test_api_token_length_matches_generate_token_string():
    raw = api_tokens_service.generate_token_string()
    assert raw.startswith("audion_")
    assert len(raw) == 71
    assert len(raw) == 7 + 64


def test_get_current_user_with_malformed_api_token_returns_401():
    """get_current_user with non-audion_ token is treated as JWT and fails."""
    session = build_session()
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="not_audion_prefix",
    )
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=credentials, session=session)
    assert exc_info.value.status_code == 401


def test_get_current_user_no_credentials_returns_401():
    """get_current_user with no credentials raises 401."""
    session = build_session()
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=None, session=session)
    assert exc_info.value.status_code == 401
