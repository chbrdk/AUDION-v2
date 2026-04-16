"""Shared headline length limit for Persona DB column (see migration notes in persona_store)."""

from __future__ import annotations

# Backward compatibility: DB may still have headline VARCHAR(256) until migration is applied everywhere.
HEADLINE_MAX_LENGTH = 256


def truncate_headline(value: str | None) -> str | None:
    if value is None:
        return None
    if HEADLINE_MAX_LENGTH <= 0 or len(value) <= HEADLINE_MAX_LENGTH:
        return value
    return value[: HEADLINE_MAX_LENGTH - 3] + "..."
