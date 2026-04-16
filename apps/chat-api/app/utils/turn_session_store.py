"""In-memory turn session state for HTTP/Voice when clients send ``session_id`` (Du/Sie lock, imperfection budget)."""

from __future__ import annotations

import threading
import time
from collections import OrderedDict

from ..core.config import get_settings
from .turn_naturalness import TurnSessionState

_lock = threading.RLock()
# insertion order = LRU: oldest at front; value = (state, last_access_monotonic)
_sessions: OrderedDict[str, tuple[TurnSessionState, float]] = OrderedDict()


def make_turn_session_key(user_id: str | None, session_id: str) -> str:
    """Namespace session_id by user_id when present to avoid accidental cross-user reuse."""
    sid = (session_id or "").strip()
    if not sid:
        raise ValueError("session_id must be non-empty")
    uid = (user_id or "").strip() or "anon"
    return f"{uid}::{sid}"


def get_or_create_turn_session(user_id: str | None, session_id: str) -> TurnSessionState:
    """
    Return stable ``TurnSessionState`` for this logical chat session.
    Evicts idle entries past TTL and caps total entries (LRU).
    """
    settings = get_settings()
    key = make_turn_session_key(user_id, session_id)
    now = time.monotonic()
    ttl = float(settings.turn_naturalness_http_session_ttl_seconds)
    max_entries = settings.turn_naturalness_http_session_max_entries

    with _lock:
        _purge_expired_locked(now, ttl)
        if key in _sessions:
            state, _ = _sessions.pop(key)
            _sessions[key] = (state, now)
            return state
        while len(_sessions) >= max_entries and _sessions:
            _sessions.popitem(last=False)
        state = TurnSessionState()
        _sessions[key] = (state, now)
        return state


def _purge_expired_locked(now: float, ttl: float) -> None:
    if ttl <= 0:
        return
    stale_keys = [k for k, (_, ts) in _sessions.items() if now - ts > ttl]
    for k in stale_keys:
        del _sessions[k]


def reset_turn_session_store_for_tests() -> None:
    """Clear store (unit tests only)."""
    with _lock:
        _sessions.clear()
