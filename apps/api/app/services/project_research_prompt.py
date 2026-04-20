"""Optional PROJECT AI RESEARCH JSON block for LLM context (suggest flows)."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from ..models import Project, ProjectResearchRun, ProjectResearchSummary


def build_optional_project_research_json_context(session: Session, *, project: Project) -> str | None:
    """
    Latest research run's EN canonical summary as compact JSON text, or None.

    The stored dict typically includes structured fields (e.g. positioning, GEO questions,
    competition) produced by the project AI research pipeline — same payload the admin UI shows.
    """
    latest_run = (
        session.query(ProjectResearchRun)
        .where(ProjectResearchRun.project_id == project.id)
        .order_by(ProjectResearchRun.created_at.desc())
        .first()
    )
    if not latest_run:
        return None
    latest_summary = (
        session.query(ProjectResearchSummary)
        .where(ProjectResearchSummary.run_id == latest_run.id)
        .order_by(ProjectResearchSummary.created_at.desc())
        .first()
    )
    if not latest_summary or not isinstance(latest_summary.summary_en, dict):
        return None
    try:
        research_compact = json.dumps(latest_summary.summary_en, ensure_ascii=False)
    except Exception:
        return None
    if not research_compact.strip():
        return None
    return "PROJECT AI RESEARCH (JSON, English canonical):\n" + research_compact
