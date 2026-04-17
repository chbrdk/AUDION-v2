"""Pure helpers for bilingual persona EN/DE mirrors (no I/O, no ORM imports)."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


def json_shape_compatible(en: Any, de: Any) -> bool:
    """Best-effort structural compatibility check for EN/DE JSON mirrors."""

    if type(en) is not type(de):
        return False
    if en is None:
        return de is None
    if isinstance(en, dict):
        if not isinstance(de, dict):
            return False
        if set(en.keys()) != set(de.keys()):
            return False
        return all(json_shape_compatible(en[k], de[k]) for k in en.keys())
    if isinstance(en, list):
        if not isinstance(de, list):
            return False
        if len(en) != len(de):
            return False
        return all(json_shape_compatible(a, b) for a, b in zip(en, de))
    # Scalars (str/int/float/bool) — types must match; values may differ by language.
    return True


@runtime_checkable
class _PersonaLike(Protocol):
    headline_de: str | None
    profile: dict[str, Any] | None
    profile_de: dict[str, Any] | None
    profile_card: Any
    profile_card_de: Any


@runtime_checkable
class _PersonaPromptLike(Protocol):
    system_prompt: str | None
    system_prompt_de: str | None


def validate_bilingual_publish(*, persona: _PersonaLike, prompt_model: _PersonaPromptLike | None) -> None:
    """Publishing requires complete DE mirrors for top-level bilingual surfaces."""

    hl_de = (persona.headline_de or "").strip()
    if not hl_de:
        raise ValueError("bilingual_publish_incomplete: headline_de is required when status is published")

    if persona.profile_de is None:
        raise ValueError("bilingual_publish_incomplete: profile_de is required when status is published")
    if not json_shape_compatible(persona.profile or {}, persona.profile_de or {}):
        raise ValueError("bilingual_publish_incomplete: profile_de must be shape-compatible with profile")

    if persona.profile_card is not None:
        if persona.profile_card_de is None:
            raise ValueError("bilingual_publish_incomplete: profile_card_de is required when profile_card exists")
        if not json_shape_compatible(persona.profile_card, persona.profile_card_de):
            raise ValueError("bilingual_publish_incomplete: profile_card_de must be shape-compatible with profile_card")

    en_prompt = (prompt_model.system_prompt if prompt_model else "") or ""
    de_prompt = (prompt_model.system_prompt_de if prompt_model else None) or ""
    if prompt_model is not None and en_prompt.strip():
        if not de_prompt.strip():
            raise ValueError("bilingual_publish_incomplete: system_prompt_de is required when system_prompt exists")
