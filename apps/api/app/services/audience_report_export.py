"""Export target groups + personas for CHECKION project reports (read-only)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..models import Persona, PersonaUxJourneyRun, Project, TargetGroup
from .persona_ux_journey_runs_schema import (
    ensure_persona_ux_journey_runs_table,
    is_missing_persona_ux_journey_runs_error,
)


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


def resolve_audion_project_for_checkion(
    session: Session,
    *,
    checkion_project_id: str,
    platform_project_id: str | None = None,
) -> tuple[Project | None, str | None]:
    """
    Resolve AUDION project for a CHECKION report.

    1. ``projects.checkion_project_id`` (explicit link)
    2. ``projects.platform_project_id`` (PLEXON federation fallback)
    """
    cpid = (checkion_project_id or "").strip()
    if cpid:
        project = session.scalars(
            select(Project).where(Project.checkion_project_id == cpid).limit(1)
        ).first()
        if project is not None:
            return project, "checkion_project_id"

    ppid = (platform_project_id or "").strip()
    if ppid:
        project = session.scalars(
            select(Project).where(Project.platform_project_id == ppid).limit(1)
        ).first()
        if project is not None:
            return project, "platform_project_id"

    return None, None


def link_audion_project_to_checkion(
    session: Session,
    *,
    checkion_project_id: str,
    audion_project_id: UUID,
) -> dict[str, Any]:
    """Set ``checkion_project_id`` on an AUDION project (CHECKION inbound link)."""
    cpid = (checkion_project_id or "").strip()
    if not cpid:
        return {"ok": False, "reason": "missing_checkion_project_id"}

    project = session.get(Project, audion_project_id)
    if project is None:
        return {"ok": False, "reason": "audion_project_not_found"}

    # Clear duplicate links to the same CHECKION project on other AUDION rows.
    others = session.scalars(
        select(Project).where(
            Project.checkion_project_id == cpid,
            Project.id != audion_project_id,
        )
    ).all()
    for other in others:
        other.checkion_project_id = None

    project.checkion_project_id = cpid
    session.commit()
    session.refresh(project)
    return {
        "ok": True,
        "audionProjectId": str(project.id),
        "audionProjectName": project.name,
        "checkionProjectId": cpid,
    }


def list_audion_projects_for_checkion_link(
    session: Session,
    *,
    limit: int = 200,
) -> list[dict[str, Any]]:
    rows = session.scalars(
        select(Project).order_by(Project.name.asc()).limit(max(1, min(limit, 500)))
    ).all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "checkionProjectId": (p.checkion_project_id or "").strip() or None,
            "platformProjectId": (p.platform_project_id or "").strip() or None,
        }
        for p in rows
    ]


def _load_personas_for_audience_export(
    session: Session,
    project_id: UUID,
    max_personas: int,
) -> list[Persona]:
    """Load personas; UX-journey runs are optional (legacy DBs may lack the table)."""
    limit = max(1, min(max_personas, 48))
    query = (
        select(Persona)
        .where(Persona.project_id == project_id)
        .order_by(Persona.name.asc())
        .limit(limit)
    )

    def _with_ux_runs() -> list[Persona]:
        return session.scalars(query.options(joinedload(Persona.ux_journey_runs))).all()

    def _without_ux_runs() -> list[Persona]:
        rows = session.scalars(query).all()
        for persona in rows:
            object.__setattr__(persona, "ux_journey_runs", [])
        return rows

    try:
        return _with_ux_runs()
    except Exception as exc:
        session.rollback()
        if is_missing_persona_ux_journey_runs_error(exc) and ensure_persona_ux_journey_runs_table(session):
            session.rollback()
            try:
                return _with_ux_runs()
            except Exception:
                session.rollback()
        return _without_ux_runs()


def build_audience_report_context(
    session: Session,
    *,
    checkion_project_id: str,
    platform_project_id: str | None = None,
    max_personas: int = 24,
) -> dict[str, Any]:
    """
    Resolve AUDION project by linked CHECKION project id and export audience facts.
    """
    cpid = (checkion_project_id or "").strip()
    if not cpid:
        return {"available": False, "reason": "missing_checkion_project_id"}

    project, resolved_via = resolve_audion_project_for_checkion(
        session,
        checkion_project_id=cpid,
        platform_project_id=platform_project_id,
    )
    if project is None:
        return {"available": False, "reason": "no_audion_project_for_checkion_id"}

    target_groups = session.scalars(
        select(TargetGroup)
        .where(TargetGroup.project_id == project.id)
        .order_by(TargetGroup.name.asc())
    ).all()

    personas = _load_personas_for_audience_export(session, project.id, max_personas)

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
        "resolvedVia": resolved_via,
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


def find_audion_project_id_for_checkion(
    session: Session,
    checkion_project_id: str,
    platform_project_id: str | None = None,
) -> UUID | None:
    project, _ = resolve_audion_project_for_checkion(
        session,
        checkion_project_id=checkion_project_id,
        platform_project_id=platform_project_id,
    )
    return project.id if project else None
