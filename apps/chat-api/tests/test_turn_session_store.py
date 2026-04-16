"""Turn session store for HTTP (session_id)."""

from __future__ import annotations

import pytest

from app.utils.turn_session_store import (
    get_or_create_turn_session,
    make_turn_session_key,
    reset_turn_session_store_for_tests,
)


@pytest.fixture(autouse=True)
def _clear_store() -> None:
    reset_turn_session_store_for_tests()
    yield
    reset_turn_session_store_for_tests()


def test_make_turn_session_key_requires_non_empty_session_id() -> None:
    with pytest.raises(ValueError):
        make_turn_session_key(None, "  ")


def test_same_key_returns_same_state() -> None:
    a = get_or_create_turn_session("user-1", "conv-a")
    b = get_or_create_turn_session("user-1", "conv-a")
    assert a is b


def test_different_user_namespaces_session() -> None:
    a = get_or_create_turn_session("u1", "same-id")
    b = get_or_create_turn_session("u2", "same-id")
    assert a is not b


def test_different_session_id_returns_different_state() -> None:
    a = get_or_create_turn_session(None, "a")
    b = get_or_create_turn_session(None, "b")
    assert a is not b
