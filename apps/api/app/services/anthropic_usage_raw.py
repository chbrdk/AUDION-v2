"""PLEXON raw_units from Anthropic Messages API response objects."""
from __future__ import annotations

from typing import Any


def raw_units_from_anthropic_message(message: Any) -> dict[str, Any]:
    u = getattr(message, "usage", None)
    if u is None:
        return {}
    raw: dict[str, Any] = {}
    it = getattr(u, "input_tokens", None)
    ot = getattr(u, "output_tokens", None)
    if it is not None:
        raw["input_tokens"] = int(it)
    if ot is not None:
        raw["output_tokens"] = int(ot)
    return raw
