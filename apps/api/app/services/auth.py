from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..db import get_db
from ..models import User
from .api_tokens import get_user_id_by_token_hash, hash_token

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

API_TOKEN_PREFIX = "audion_"
API_TOKEN_HEX_LEN = 64
API_TOKEN_LEN = len(API_TOKEN_PREFIX) + API_TOKEN_HEX_LEN  # audion_ + 64 hex


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(*, user: User) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.auth_access_token_minutes)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(payload, settings.auth_jwt_secret, algorithm=settings.auth_jwt_algorithm)


def get_current_user(
    session: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> User:
    """
    Resolve user from Bearer token or X-API-Key (no cookie required).
    For Opal / server-to-server: use API token (audion_<64 hex>) as
    Authorization: Bearer <token> or X-API-Key: <token>.
    """
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    if not token and x_api_key and x_api_key.strip():
        token = x_api_key.strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    # API token (audion_ + 64 hex): resolve via api_tokens table
    if (
        token.startswith(API_TOKEN_PREFIX)
        and len(token) == API_TOKEN_LEN
        and all(c in "0123456789abcdef" for c in token[len(API_TOKEN_PREFIX) :])
    ):
        token_hash = hash_token(token)
        user_id = get_user_id_by_token_hash(session, token_hash)
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API token")
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user

    # JWT (session / login)
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.auth_jwt_secret, algorithms=[settings.auth_jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    try:
        user_id = UUID(subject)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject") from exc

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
