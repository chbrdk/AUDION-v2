"""Helper functions for building persona AI context."""
from __future__ import annotations

import json
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from ..models import Persona
from ..services.persona_store import PersonaService
from ..services.target_group_store import TargetGroupService

persona_service = PersonaService()
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


def _persona_existing_pain_points(persona: Persona) -> List[str]:
    profile = persona.profile or {}
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


def _persona_existing_goals(persona: Persona) -> List[str]:
    profile = persona.profile or {}
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


def _persona_existing_interests(persona: Persona) -> List[str]:
    profile = persona.profile or {}
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


def _persona_existing_values(persona: Persona) -> List[str]:
    profile = persona.profile or {}
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


def build_persona_ai_context(session: Session, persona: Persona, max_items: int) -> Dict[str, Any]:
    """Build context for persona pain points AI generation."""
    profile_json = json.dumps(persona.profile or {}, ensure_ascii=False, indent=2)
    existing_pain_points = "\n".join(_persona_existing_pain_points(persona)) or "Keine Pain Points dokumentiert."
    return {
        "persona_name": persona.name,
        "persona_segment": persona.segment,
        "persona_profile": profile_json,
        "persona_pain_points": existing_pain_points,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "max_items": max_items,
    }


def build_persona_goals_ai_context(session: Session, persona: Persona, max_items: int) -> Dict[str, Any]:
    """Build context for persona goals AI generation."""
    profile_json = json.dumps(persona.profile or {}, ensure_ascii=False, indent=2)
    existing_goals = "\n".join(_persona_existing_goals(persona)) or "Keine Goals dokumentiert."
    return {
        "persona_name": persona.name,
        "persona_segment": persona.segment,
        "persona_profile": profile_json,
        "persona_goals": existing_goals,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "max_items": max_items,
    }


def build_persona_interests_ai_context(session: Session, persona: Persona, max_items: int) -> Dict[str, Any]:
    """Build context for persona interests AI generation."""
    profile_json = json.dumps(persona.profile or {}, ensure_ascii=False, indent=2)
    existing_interests = "\n".join(_persona_existing_interests(persona)) or "Keine Interests dokumentiert."
    return {
        "persona_name": persona.name,
        "persona_segment": persona.segment,
        "persona_profile": profile_json,
        "persona_interests": existing_interests,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "max_items": max_items,
    }


def build_persona_values_ai_context(session: Session, persona: Persona, max_items: int) -> Dict[str, Any]:
    """Build context for persona values AI generation."""
    profile_json = json.dumps(persona.profile or {}, ensure_ascii=False, indent=2)
    existing_values = "\n".join(_persona_existing_values(persona)) or "Keine Values dokumentiert."
    return {
        "persona_name": persona.name,
        "persona_segment": persona.segment,
        "persona_profile": profile_json,
        "persona_values": existing_values,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "max_items": max_items,
    }


