"""Unit tests for API token service: hash, generate, create, list, revoke, get_user_id_by_token_hash."""
from __future__ import annotations

import os
from datetime import datetime
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("AUTH_JWT_SECRET", "test-secret")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, ApiToken, User
from app.services import api_tokens as api_tokens_service


def build_session():
    """In-memory SQLite session. Schema 'audion' is not used by SQLite."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def test_hash_token():
    """hash_token returns SHA-256 hex of the token."""
    out = api_tokens_service.hash_token("audion_abc123")
    assert isinstance(out, str)
    assert len(out) == 64
    assert all(c in "0123456789abcdef" for c in out)
    assert api_tokens_service.hash_token("x") != api_tokens_service.hash_token("y")


def test_generate_token_string():
    """generate_token_string returns audion_ + 64 hex chars."""
    t = api_tokens_service.generate_token_string()
    assert t.startswith("audion_")
    assert len(t) == 9 + 64
    assert all(c in "0123456789abcdef" for c in t[9:])
    t2 = api_tokens_service.generate_token_string()
    assert t != t2


def test_create_api_token():
    """create_api_token persists token and returns id, token (plain), name, created_at."""
    session = build_session()
    user = User(
        id=uuid4(),
        email="test@example.com",
        password_hash="hash",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(user)
    session.flush()

    created = api_tokens_service.create_api_token(session, user.id, name="MCP")
    session.commit()

    assert "id" in created
    assert "token" in created
    assert created["token"].startswith("audion_")
    assert created["name"] == "MCP"
    assert "created_at" in created

    # Token is stored as hash only
    row = session.query(ApiToken).filter(ApiToken.id == created["id"]).first()
    assert row is not None
    assert row.token_hash == api_tokens_service.hash_token(created["token"])
    assert row.user_id == user.id


def test_get_user_id_by_token_hash():
    """get_user_id_by_token_hash returns user_id for valid hash, None otherwise."""
    session = build_session()
    user = User(
        id=uuid4(),
        email="u@example.com",
        password_hash="h",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(user)
    session.flush()
    raw = api_tokens_service.generate_token_string()
    token_hash = api_tokens_service.hash_token(raw)
    session.add(
        ApiToken(
            id=uuid4(),
            user_id=user.id,
            token_hash=token_hash,
            created_at=datetime.utcnow(),
        )
    )
    session.commit()

    found = api_tokens_service.get_user_id_by_token_hash(session, token_hash)
    assert found == user.id
    assert api_tokens_service.get_user_id_by_token_hash(session, "nonexistent") is None


def test_list_api_tokens():
    """list_api_tokens returns id, name, created_at for user's tokens."""
    session = build_session()
    user = User(
        id=uuid4(),
        email="u2@example.com",
        password_hash="h",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(user)
    session.flush()
    session.add(
        ApiToken(
            id=uuid4(),
            user_id=user.id,
            token_hash="a" * 64,
            name="First",
            created_at=datetime.utcnow(),
        )
    )
    session.add(
        ApiToken(
            id=uuid4(),
            user_id=user.id,
            token_hash="b" * 64,
            name=None,
            created_at=datetime.utcnow(),
        )
    )
    session.commit()

    items = api_tokens_service.list_api_tokens(session, user.id)
    assert len(items) == 2
    for i in items:
        assert "id" in i and "name" in i and "created_at" in i
        assert "token" not in i and "token_hash" not in i


def test_revoke_api_token():
    """revoke_api_token deletes own token; returns False for wrong user or invalid id."""
    session = build_session()
    user1 = User(
        id=uuid4(),
        email="u1@example.com",
        password_hash="h",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    user2 = User(
        id=uuid4(),
        email="u2@example.com",
        password_hash="h",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(user1)
    session.add(user2)
    session.flush()
    tok = ApiToken(
        id=uuid4(),
        user_id=user1.id,
        token_hash="c" * 64,
        created_at=datetime.utcnow(),
    )
    session.add(tok)
    session.commit()
    token_id = str(tok.id)

    assert api_tokens_service.revoke_api_token(session, token_id, user1.id) is True
    session.commit()
    assert session.get(ApiToken, tok.id) is None

    new_tok = ApiToken(
        id=uuid4(),
        user_id=user1.id,
        token_hash="d" * 64,
        created_at=datetime.utcnow(),
    )
    session.add(new_tok)
    session.commit()
    # user2 cannot revoke user1's token
    assert api_tokens_service.revoke_api_token(session, str(new_tok.id), user2.id) is False
    assert api_tokens_service.revoke_api_token(session, "not-a-uuid", user1.id) is False
