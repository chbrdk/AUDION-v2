"""Export target groups + personas for CHECKION project reports (read-only)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..models import Persona, PersonaUxJourneyRun, Project, TargetGroup


def _profile_strings(profile: dict[str, Any] | None, key: str, limit: int = 8) -> list[str]:
    if not isinstance(profile, dict):
        return []
    raw = profile.get(key)
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw[:limit]:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif isinstance(item, dict):
            label = item.get("label") or item.get("name") or item.get("text")
            if isinstance(label, str) and label.strip():
                out.append(label.strip())
    return out


def _serialize_ux_run(row: PersonaUxJourneyRun | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": str(row.id),
        "jobId": row.job_id,
        "task": row.task,
        "siteUrl": row.site_url,
        "success": row.success,
        "stepsCount": row.steps_count,
        "scorecard": row.scorecard if isinstance(row.scorecard, dict) else None,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


def build_audience_report_context(
    session: Session,
    *,
    checkion_project_id: str,
    max_personas: int = 24,
) -> dict[str, Any]:
    """
    Resolve AUDION project by linked CHECKION project id and export audience facts.
    """
    cpid = (checkion_project_id or "").strip()
    if not cpid:
        return {"available": False, "reason": "missing_checkion_project_id"}

    project = session.scalars(
        select(Project).where(Project.checkion_project_id == cpid).limit(1)
    ).first()
    if project is None:
        return {"available": False, "reason": "no_audion_project_for_checkion_id"}

    target_groups = session.scalars(
        select(TargetGroup)
        .where(TargetGroup.project_id == project.id)
        .order_by(TargetGroup.name.asc())
    ).all()

    personas = session.scalars(
        select(Persona)
        .where(Persona.project_id == project.id)
        .options(joinedload(Persona.ux_journey_runs))
        .order_by(Persona.name.asc())
        .limit(max(1, min(max_personas, 48)))
    ).all()

    tg_by_id = {tg.id: tg for tg in target_groups}

    persona_rows: list[dict[str, Any]] = []
    for p in personas:
        profile = p.profile if isinstance(p.profile, dict) else {}
        tg = tg_by_id.get(p.target_group_id) if p.target_group_id else None
        latest_run = None
        if p.ux_journey_runs:
            latest_run = sorted(
                p.ux_journey_runs,
                key=lambda r: r.created_at or r.id,
                reverse=True,
            )[0]
        persona_rows.append(
            {
                "id": str(p.id),
                "name": p.name,
                "headline": p.headline,
                "segment": p.segment,
                "targetGroupId": str(p.target_group_id) if p.target_group_id else None,
                "targetGroupName": tg.name if tg else None,
                "painPoints": _profile_strings(profile, "pain_points"),
                "goals": _profile_strings(profile, "goals"),
                "interests": _profile_strings(profile, "interests"),
                "latestUxJourney": _serialize_ux_run(latest_run),
            }
        )

    return {
        "available": True,
        "audionProjectId": str(project.id),
        "audionProjectName": project.name,
        "checkionProjectId": cpid,
        "targetGroups": [
            {
                "id": str(tg.id),
                "name": tg.name,
                "segment": tg.segment,
                "description": (tg.description or "")[:500] or None,
                "personaCount": sum(1 for p in personas if p.target_group_id == tg.id),
            }
            for tg in target_groups
        ],
        "personas": persona_rows,
    }


def find_audion_project_id_for_checkion(session: Session, checkion_project_id: str) -> UUID | None:
    cpid = (checkion_project_id or "").strip()
    if not cpid:
        return None
    project = session.scalars(
        select(Project).where(Project.checkion_project_id == cpid).limit(1)
    ).first()
    return project.id if project else None
