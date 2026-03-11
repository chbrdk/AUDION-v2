"""Shared dependencies for Chat API (e.g. optional request auth)."""
from __future__ import annotations

from fastapi import HTTPException, Request
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from .core.config import get_settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
_bearer = HTTPBearer(auto_error=False)


async def verify_request_token(request: Request) -> None:
    """
    If auth_api_key is configured, require Authorization: Bearer <key> or X-API-Key: <key>.
    Otherwise allow all requests. Raises 401 when required and missing/invalid.
    """
    settings = get_settings()
    if not settings.auth_api_key or not settings.auth_api_key.strip():
        return

    key = settings.auth_api_key.strip()
    # Try Bearer
    auth: HTTPAuthorizationCredentials | None = await _bearer(request)
    if auth and auth.credentials == key:
        return
    # Try X-API-Key
    api_key = await _api_key_header(request)
    if api_key and api_key == key:
        return

    raise HTTPException(status_code=401, detail="Missing or invalid authorization")


def _get_request_key(request: Request) -> str | None:
    """Extract Bearer token or X-API-Key from request (for reuse in WebSocket)."""
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth[7:].strip()
    return request.headers.get("X-API-Key")


async def verify_websocket_token(websocket: "WebSocket") -> bool:
    """
    If auth_api_key is configured, require Authorization: Bearer <key> or X-API-Key in WebSocket headers.
    Returns False if auth required and missing/invalid (caller should return without calling connect).
    On failure we accept then close with code 4401 so the client gets a clean close.
    """
    from fastapi import WebSocket
    settings = get_settings()
    if not settings.auth_api_key or not settings.auth_api_key.strip():
        return True
    key = settings.auth_api_key.strip()
    auth = websocket.headers.get("Authorization")
    provided = (auth[7:].strip() if auth and auth.startswith("Bearer ") else None) or websocket.headers.get("X-API-Key")
    if provided == key:
        return True
    await websocket.accept()
    await websocket.close(code=4401)  # custom: unauthorized
    return False
