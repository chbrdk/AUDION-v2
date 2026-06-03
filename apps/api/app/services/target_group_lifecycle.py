"""Target group lifecycle — active (default) and archived (hidden from default lists)."""

from __future__ import annotations

_TARGET_GROUP_STATUSES = frozenset({"active", "archived"})
_LEGACY_ACTIVE_STATUSES = frozenset({"draft", "published", "active", ""})


def _norm(value: object | None) -> str:
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(getattr(value, "value", "") or "").strip().lower()
    return str(value).strip().lower()


def coerce_target_group_status(value: object | None) -> str:
    """Map DB/API values to ``active`` or ``archived`` (legacy draft/published → active)."""

    s = _norm(value)
    if s == "archived":
        return "archived"
    return "active"


def normalize_target_group_status(value: object | None) -> str:
    """Validate writes — only ``active`` or ``archived`` allowed."""

    if value is None or (isinstance(value, str) and not value.strip()):
        return "active"
    s = _norm(value)
    if s in _LEGACY_ACTIVE_STATUSES:
        return "active"
    if s == "archived":
        return "archived"
    raise ValueError("target_group_status_invalid: status must be 'active' or 'archived'")


def is_target_group_archived(value: object | None) -> bool:
    return coerce_target_group_status(value) == "archived"
