"""Unit tests for target group lifecycle status (no DB)."""

from __future__ import annotations

import pytest

from app.services.target_group_lifecycle import (
    coerce_target_group_status,
    is_target_group_archived,
    normalize_target_group_status,
)


def test_coerce_maps_legacy_and_archived() -> None:
    assert coerce_target_group_status(None) == "active"
    assert coerce_target_group_status("") == "active"
    assert coerce_target_group_status("draft") == "active"
    assert coerce_target_group_status("published") == "active"
    assert coerce_target_group_status("active") == "active"
    assert coerce_target_group_status("  ARCHIVED ") == "archived"


def test_normalize_accepts_active_and_archived() -> None:
    assert normalize_target_group_status(None) == "active"
    assert normalize_target_group_status("active") == "active"
    assert normalize_target_group_status("draft") == "active"
    assert normalize_target_group_status("published") == "active"
    assert normalize_target_group_status("archived") == "archived"


def test_normalize_rejects_unknown() -> None:
    with pytest.raises(ValueError, match="target_group_status_invalid"):
        normalize_target_group_status("live")


def test_is_target_group_archived() -> None:
    assert is_target_group_archived("archived") is True
    assert is_target_group_archived("published") is False
    assert is_target_group_archived(None) is False
