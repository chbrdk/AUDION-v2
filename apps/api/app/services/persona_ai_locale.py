"""Shared admin AI locale + profile merge (aligned with web `profileForChips` / bilingual admin)."""
from __future__ import annotations

from typing import Any


def normalize_output_locale(value: Any) -> str:
    """Canonical UI locale for persona AI: \"en\" or \"de\" (default \"de\" for backward compatibility)."""
    if value is None:
        return "de"
    s = str(value).strip().lower()
    if not s:
        return "de"
    if s in ("en", "english", "en-us", "en-gb"):
        return "en"
    return "de"


def locale_label_for_ai_prompt(normalized: str) -> str:
    """Value for templates.yaml `${generated_text_locale_name}`."""
    return "English" if normalized == "en" else "German"


def merge_communication_style_de_overlay(en_cs: dict[str, Any] | None, de_cs: dict[str, Any] | None) -> dict[str, Any]:
    """Match web `mergeCommunicationStyle(en, dePatch)` for vocabulary / sentence_structure / skepticism_level."""
    b = dict(en_cs) if isinstance(en_cs, dict) else {}
    if not isinstance(de_cs, dict) or not de_cs:
        return {
            "vocabulary": list(b.get("vocabulary") or []) if isinstance(b.get("vocabulary"), list) else [],
            "sentence_structure": str(b.get("sentence_structure") or ""),
            "skepticism_level": int(b.get("skepticism_level") or 0),
        }
    p = dict(de_cs)
    bv = b.get("vocabulary")
    pv = p.get("vocabulary")
    if isinstance(pv, list):
        vocab: list[Any] = pv
    elif isinstance(bv, list):
        vocab = bv
    else:
        vocab = []
    return {
        **b,
        **p,
        "vocabulary": vocab,
        "sentence_structure": p.get("sentence_structure", b.get("sentence_structure", "")),
        "skepticism_level": p.get("skepticism_level", b.get("skepticism_level", 0)),
    }


def persona_profile_for_ai(persona: Any, output_locale: str) -> dict[str, Any]:
    """
    When output_locale is \"de\", merge list + communication + bio-like fields from `profile_de`
    over English `profile` (same idea as web `profileForChips`). Traits stay on EN `profile` keys only.
    """
    en = persona.profile if isinstance(persona.profile, dict) else {}
    if output_locale != "de":
        return dict(en)
    raw_de = persona.profile_de
    de = raw_de if isinstance(raw_de, dict) else {}
    out: dict[str, Any] = dict(en)
    for key in ("interests", "values", "social_media_usage", "pain_points", "goals"):
        if isinstance(de.get(key), list):
            out[key] = de[key]
    en_cs = en.get("communication_style") if isinstance(en.get("communication_style"), dict) else {}
    de_cs = de.get("communication_style") if isinstance(de.get("communication_style"), dict) else {}
    if de_cs:
        out["communication_style"] = merge_communication_style_de_overlay(en_cs, de_cs)
    elif isinstance(en.get("communication_style"), dict):
        out["communication_style"] = dict(en_cs)
    if "bio" in de and isinstance(de.get("bio"), str):
        out["bio"] = de["bio"]
    if "full_name" in de:
        out["full_name"] = de["full_name"]
    if "location" in de and isinstance(de.get("location"), str):
        out["location"] = de["location"]
    return out


def finalize_ai_locale_context(ctx: dict[str, Any]) -> dict[str, Any]:
    """
    Canonical `output_locale` wins; `generated_text_locale_name` is always derived from it.
    If only `generated_text_locale_name` is set (legacy), infer `output_locale` before defaulting to de.
    """
    out = dict(ctx)
    raw_ol = out.get("output_locale") or out.get("ui_locale")
    if str(raw_ol or "").strip():
        loc = normalize_output_locale(raw_ol)
    elif str(out.get("generated_text_locale_name") or "").strip():
        g = str(out["generated_text_locale_name"]).strip().lower()
        loc = "en" if g in ("english", "en") else "de"
    else:
        loc = "de"
    out["output_locale"] = loc
    out["generated_text_locale_name"] = locale_label_for_ai_prompt(loc)
    return out
