"""Helper functions for building persona AI context."""
from __future__ import annotations

import json
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from ..models import Persona
from .persona_ai_locale import locale_label_for_ai_prompt, normalize_output_locale, persona_profile_for_ai
from .target_group_store import TargetGroupService

target_group_service = TargetGroupService()


def _persona_target_group_summary(session: Session, persona: Persona) -> str:
    if not persona.target_group_id:
        return "Keine Target Group verknüpft."
    try:
        tg = target_group_service.get_target_group(session, str(persona.target_group_id))
    except ValueError:
        return "Target Group konnte nicht geladen werden."
    summary = f"{tg.name} • Segment: {tg.segment or 'n/a'}"
    if tg.description:
        summary += f"\nBeschreibung: {tg.description}"
    return summary


def _persona_existing_pain_points(profile: dict[str, Any]) -> List[str]:
    candidates = profile.get("pain_points") or profile.get("painPoints") or []
    values: List[str] = []
    if isinstance(candidates, list):
        for entry in candidates:
            if isinstance(entry, dict):
                label = entry.get("label") or entry.get("title")
                desc = entry.get("description") or entry.get("content")
                if label and desc:
                    values.append(f"{label}: {desc}")
                elif label:
                    values.append(label)
                elif desc:
                    values.append(desc)
            elif isinstance(entry, str):
                values.append(entry)
    return values


def _persona_existing_goals(profile: dict[str, Any]) -> List[str]:
    candidates = profile.get("goals") or []
    values: List[str] = []
    if isinstance(candidates, list):
        for entry in candidates:
            if isinstance(entry, dict):
                label = entry.get("label") or entry.get("title")
                desc = entry.get("description") or entry.get("content")
                if label and desc:
                    values.append(f"{label}: {desc}")
                elif label:
                    values.append(label)
                elif desc:
                    values.append(desc)
            elif isinstance(entry, str):
                values.append(entry)
    return values


def _persona_existing_interests(profile: dict[str, Any]) -> List[str]:
    candidates = profile.get("interests") or []
    values: List[str] = []
    if isinstance(candidates, list):
        for entry in candidates:
            if isinstance(entry, str):
                values.append(entry)
            elif isinstance(entry, dict):
                label = entry.get("label") or entry.get("title") or entry.get("name")
                desc = entry.get("description") or entry.get("content")
                if label and desc:
                    values.append(f"{label}: {desc}")
                elif label:
                    values.append(label)
                elif desc:
                    values.append(desc)
    return values


def _persona_existing_values(profile: dict[str, Any]) -> List[str]:
    candidates = profile.get("values") or []
    values: List[str] = []
    if isinstance(candidates, list):
        for entry in candidates:
            if isinstance(entry, str):
                values.append(entry)
            elif isinstance(entry, dict):
                label = entry.get("label") or entry.get("title") or entry.get("name")
                desc = entry.get("description") or entry.get("content")
                if label and desc:
                    values.append(f"{label}: {desc}")
                elif label:
                    values.append(label)
                elif desc:
                    values.append(desc)
    return values


def _persona_existing_traits(profile: dict[str, Any]) -> str:
    raw = profile.get("traits")
    if not raw:
        return "Keine Traits dokumentiert."
    if isinstance(raw, dict):
        lines = [f"{k}: {v}" if isinstance(v, str) else str(k) for k, v in raw.items()]
        return "\n".join(lines) if lines else "Keine Traits dokumentiert."
    if isinstance(raw, list):
        lines = []
        for item in raw:
            if isinstance(item, dict):
                name = item.get("name") or item.get("label") or item.get("title") or item.get("content")
                desc = item.get("description") or item.get("type")
                if name and desc:
                    lines.append(f"{name}: {desc}")
                elif name:
                    lines.append(name)
            elif isinstance(item, str):
                lines.append(item)
        return "\n".join(lines) if lines else "Keine Traits dokumentiert."
    return "Keine Traits dokumentiert."


def _persona_existing_vocabulary(profile: dict[str, Any]) -> str:
    comm = profile.get("communication_style") or profile.get("communicationStyle") or {}
    if isinstance(comm, str):
        return "Keine Vocabulary dokumentiert."
    raw = comm.get("vocabulary") if isinstance(comm, dict) else None
    if not raw or not isinstance(raw, list):
        return "Keine Vocabulary dokumentiert."
    lines = []
    for item in raw:
        if isinstance(item, dict):
            word = item.get("word") or item.get("label") or item.get("title") or item.get("content")
            if word:
                lines.append(str(word))
        elif isinstance(item, str):
            lines.append(item)
    return "\n".join(lines) if lines else "Keine Vocabulary dokumentiert."


def _locale_fields(output_locale: str | None) -> dict[str, str]:
    loc = normalize_output_locale(output_locale)
    return {
        "output_locale": loc,
        "generated_text_locale_name": locale_label_for_ai_prompt(loc),
    }


def build_persona_ai_context(
    session: Session, persona: Persona, max_items: int, *, output_locale: str | None = None
) -> Dict[str, Any]:
    """Build context for persona pain points AI generation."""
    loc = normalize_output_locale(output_locale)
    prof = persona_profile_for_ai(persona, loc)
    profile_json = json.dumps(prof, ensure_ascii=False, indent=2)
    existing_pain_points = "\n".join(_persona_existing_pain_points(prof)) or "Keine Pain Points dokumentiert."
    return {
        "persona_name": persona.name,
        "persona_segment": persona.segment,
        "persona_profile": profile_json,
        "persona_pain_points": existing_pain_points,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "max_items": max_items,
        **_locale_fields(output_locale),
    }


def build_persona_goals_ai_context(
    session: Session, persona: Persona, max_items: int, *, output_locale: str | None = None
) -> Dict[str, Any]:
    """Build context for persona goals AI generation."""
    loc = normalize_output_locale(output_locale)
    prof = persona_profile_for_ai(persona, loc)
    profile_json = json.dumps(prof, ensure_ascii=False, indent=2)
    existing_goals = "\n".join(_persona_existing_goals(prof)) or "Keine Goals dokumentiert."
    return {
        "persona_name": persona.name,
        "persona_segment": persona.segment,
        "persona_profile": profile_json,
        "persona_goals": existing_goals,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "max_items": max_items,
        **_locale_fields(output_locale),
    }


def build_persona_interests_ai_context(
    session: Session, persona: Persona, max_items: int, *, output_locale: str | None = None
) -> Dict[str, Any]:
    """Build context for persona interests AI generation."""
    loc = normalize_output_locale(output_locale)
    prof = persona_profile_for_ai(persona, loc)
    profile_json = json.dumps(prof, ensure_ascii=False, indent=2)
    existing_interests = "\n".join(_persona_existing_interests(prof)) or "Keine Interests dokumentiert."
    return {
        "persona_name": persona.name,
        "persona_segment": persona.segment,
        "persona_profile": profile_json,
        "persona_interests": existing_interests,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "max_items": max_items,
        **_locale_fields(output_locale),
    }


def build_persona_values_ai_context(
    session: Session, persona: Persona, max_items: int, *, output_locale: str | None = None
) -> Dict[str, Any]:
    """Build context for persona values AI generation."""
    loc = normalize_output_locale(output_locale)
    prof = persona_profile_for_ai(persona, loc)
    profile_json = json.dumps(prof, ensure_ascii=False, indent=2)
    existing_values = "\n".join(_persona_existing_values(prof)) or "Keine Values dokumentiert."
    return {
        "persona_name": persona.name,
        "persona_segment": persona.segment,
        "persona_profile": profile_json,
        "persona_values": existing_values,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "max_items": max_items,
        **_locale_fields(output_locale),
    }


def build_persona_traits_ai_context(
    session: Session, persona: Persona, max_items: int, *, output_locale: str | None = None
) -> Dict[str, Any]:
    """Build context for persona.traits template (traits keys stay EN; bio/headline follow merged profile for DE)."""
    loc = normalize_output_locale(output_locale)
    prof = persona_profile_for_ai(persona, loc)
    profile_json = json.dumps(prof, ensure_ascii=False, indent=2)
    return {
        "persona_name": persona.name or "",
        "persona_headline": persona.headline or "",
        "persona_bio": (prof.get("bio") or "").strip(),
        "existing_traits": _persona_existing_traits(prof),
        "graph_relationships_summary": "Use persona profile and target group for context.",
        "knowledge_context": profile_json,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "max_items": max_items,
        **_locale_fields(output_locale),
    }


def build_persona_vocabulary_ai_context(
    session: Session, persona: Persona, max_items: int, *, output_locale: str | None = None
) -> Dict[str, Any]:
    """Build context for persona.vocabulary template."""
    loc = normalize_output_locale(output_locale)
    prof = persona_profile_for_ai(persona, loc)
    profile_json = json.dumps(prof, ensure_ascii=False, indent=2)
    return {
        "persona_name": persona.name or "",
        "persona_headline": persona.headline or "",
        "persona_bio": (prof.get("bio") or "").strip(),
        "existing_vocabulary": _persona_existing_vocabulary(prof),
        "graph_relationships_summary": "Use persona profile and target group for context.",
        "knowledge_context": profile_json,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "max_items": max_items,
        **_locale_fields(output_locale),
    }


def build_persona_geo_questions_ai_context(
    session: Session,
    persona: Persona,
    max_items: int,
    *,
    output_locale: str | None = None,
    brand_name: str | None = None,
    brand_url: str | None = None,
) -> Dict[str, Any]:
    """Build context for persona GEO question generation (PLEXON Quick Check)."""
    loc = normalize_output_locale(output_locale)
    prof = persona_profile_for_ai(persona, loc)
    profile_json = json.dumps(prof, ensure_ascii=False, indent=2)
    existing_goals = "\n".join(_persona_existing_goals(prof)) or "Keine Goals dokumentiert."
    existing_pain_points = "\n".join(_persona_existing_pain_points(prof)) or "Keine Pain Points dokumentiert."
    return {
        "persona_name": persona.name,
        "persona_segment": persona.segment,
        "persona_profile": profile_json,
        "persona_goals": existing_goals,
        "persona_pain_points": existing_pain_points,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "brand_name": (brand_name or "").strip() or "das Unternehmen",
        "brand_url": (brand_url or "").strip() or "—",
        "max_items": max_items,
        **_locale_fields(output_locale),
    }


def build_persona_sentence_structure_ai_context(
    session: Session, persona: Persona, *, output_locale: str | None = None
) -> Dict[str, Any]:
    """Build context for persona.sentence_structure template (single text output)."""
    loc = normalize_output_locale(output_locale)
    prof = persona_profile_for_ai(persona, loc)
    profile_json = json.dumps(prof, ensure_ascii=False, indent=2)
    return {
        "persona_name": persona.name or "",
        "persona_headline": persona.headline or "",
        "persona_bio": (prof.get("bio") or "").strip(),
        "target_group_summary": _persona_target_group_summary(session, persona),
        "persona_profile": profile_json,
        **_locale_fields(output_locale),
    }
