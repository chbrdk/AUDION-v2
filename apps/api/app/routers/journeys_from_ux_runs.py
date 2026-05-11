"""REST endpoints for converting UX-journey-agent runs into Customer Journeys.

Routes:
* ``POST /journeys/from-ux-run``           — persist a journey from a run.
* ``POST /journeys/from-ux-run/preview``   — return the draft without saving.

Idempotency: when the source `persona_ux_journey_runs` row already has a
``derived_journey_id`` we return the existing journey and ``alreadyConverted=True``
unless the caller passes ``force=true`` as a query parameter.
"""

from __future__ import annotations

from typing import Any, Dict
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import (
    Journey,
    JourneyPhase,
    Persona,
    PersonaUxJourneyRun,
    TargetGroup,
    User,
)
from ..schemas import (
    JourneyFromUxRunDraftResponse,
    JourneyFromUxRunRequest,
    JourneyFromUxRunResponse,
)
from ..services.access_control import list_accessible_project_ids
from ..services.auth import get_current_user
from ..services.journey_generation import JourneyDraft, JourneyGenerationService
from ..services.journey_serializer import to_journey_response
from ..services.ux_journey_agent_client import fetch_run_payload
from ..services.ux_run_to_journey import UxRunToJourneyService


logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/journeys", tags=["journeys"])
_ux_run_service = UxRunToJourneyService()
_journey_service = JourneyGenerationService()


def get_db(current_user: User = Depends(get_current_user)):
    with get_session() as session:
        session.info["current_user_id"] = current_user.id
        session.info["allowed_project_ids"] = list_accessible_project_ids(session, current_user.id)
        yield session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _load_source(
    session: Session,
    body: JourneyFromUxRunRequest,
) -> tuple[PersonaUxJourneyRun | None, Persona | None, dict[str, Any]]:
    """Resolve the source run (DB row or live agent state) + persona context.

    Returns (db_row_or_none, persona_or_none, agent_payload).
    """
    run_row: PersonaUxJourneyRun | None = None
    if body.personaUxJourneyRunId:
        try:
            row_uuid = UUID(body.personaUxJourneyRunId)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid personaUxJourneyRunId")
        run_row = session.get(PersonaUxJourneyRun, row_uuid)
        if not run_row:
            raise HTTPException(status_code=404, detail="UX-journey run not found")

    job_id = body.jobId or (run_row.job_id if run_row else None)
    if not job_id:
        raise HTTPException(status_code=400, detail="Either personaUxJourneyRunId or jobId is required")

    persona_id_str = body.personaId or (str(run_row.persona_id) if run_row else None)
    persona: Persona | None = None
    if persona_id_str:
        try:
            persona = session.get(Persona, UUID(persona_id_str))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid personaId")
        if not persona:
            raise HTTPException(status_code=404, detail="Persona not found")
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
        if allowed_project_ids is not None and persona.project_id not in allowed_project_ids:
            raise HTTPException(status_code=404, detail="Persona not found")

    # Live agent payload is the canonical source for steps + scorecard.
    payload = await fetch_run_payload(job_id)
    return run_row, persona, payload


def _persona_snapshot(persona: Persona | None) -> dict[str, Any]:
    if not persona:
        return {}
    return {
        "id": str(persona.id),
        "name": persona.name,
        "segment": persona.segment,
        "headline": persona.headline,
        "profile": persona.profile if isinstance(persona.profile, dict) else None,
    }


def _resolve_target_group(
    session: Session,
    *,
    persona: Persona | None,
    override_id: str | None,
) -> UUID | None:
    if override_id:
        try:
            tg_uuid = UUID(override_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid targetGroupId")
        tg = session.get(TargetGroup, tg_uuid)
        if not tg:
            raise HTTPException(status_code=404, detail="Target group not found")
        return tg.id
    if persona and persona.target_group_id:
        return persona.target_group_id
    return None


def _resolve_project_id(
    persona: Persona | None,
    override_id: str | None,
) -> UUID | None:
    if override_id:
        try:
            return UUID(override_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid projectId")
    if persona:
        return persona.project_id
    return None


def _ensure_organization_id(value: str) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid organizationId")


def _extract_run_inputs(
    *,
    run_row: PersonaUxJourneyRun | None,
    payload: dict[str, Any],
) -> tuple[str, str | None, list[dict[str, Any]], dict[str, Any] | None]:
    """Pull (task, site_url, steps, scorecard) from agent payload + DB fallback."""
    result = payload.get("result") if isinstance(payload, dict) else None
    if not isinstance(result, dict):
        result = {}
    task = (
        result.get("task")
        or payload.get("task")
        or (run_row.task if run_row else None)
        or ""
    )
    site_url = (
        result.get("siteUrl")
        or result.get("url")
        or payload.get("url")
        or (run_row.site_url if run_row else None)
    )
    steps_raw = result.get("steps") if isinstance(result.get("steps"), list) else []
    scorecard = result.get("scorecard") if isinstance(result.get("scorecard"), dict) else None
    if scorecard is None and run_row and isinstance(run_row.scorecard, dict):
        scorecard = run_row.scorecard
    return task, site_url, steps_raw, scorecard


def _persist_phase_extras(
    *,
    session: Session,
    journey_id: UUID,
    draft: JourneyDraft,
) -> None:
    """Write `url_pattern` per phase after `save_journey_draft` has run.

    `save_journey_draft` does not carry forward our extra phase fields, so we
    apply them in a follow-up pass against the same DB.
    """
    if not draft.phases:
        return
    phases = (
        session.scalars(
            select(JourneyPhase)
            .where(JourneyPhase.journey_id == journey_id)
            .order_by(JourneyPhase.phase_order.asc())
        )
        .all()
    )
    by_order = {p.phase_order: p for p in phases}
    for phase_data in draft.phases:
        url_pattern = phase_data.get("url_pattern")
        if not isinstance(url_pattern, dict):
            continue
        phase = by_order.get(int(phase_data.get("phase_order", 0)))
        if not phase:
            continue
        phase.url_pattern = url_pattern
        session.add(phase)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/from-ux-run",
    response_model=JourneyFromUxRunResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Convert a UX-journey-agent run into a structured Customer Journey",
)
async def create_journey_from_ux_run(
    body: JourneyFromUxRunRequest,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    force: bool = Query(False, description="Re-convert even when this run already produced a journey."),
) -> JourneyFromUxRunResponse:
    run_row, persona, payload = await _load_source(session, body)

    # Idempotency: existing derived journey wins unless force=True.
    if run_row and run_row.derived_journey_id and not force:
        journey = session.get(Journey, run_row.derived_journey_id)
        if journey:
            return JourneyFromUxRunResponse(
                journey=to_journey_response(journey),
                mode="existing",
                fallbackUsed=False,
                alreadyConverted=True,
            )

    task, site_url, steps_raw, scorecard = _extract_run_inputs(run_row=run_row, payload=payload)
    persona_dict = _persona_snapshot(persona) if persona else None

    draft, mode_used, fallback_used = await _ux_run_service.convert(
        mode=body.mode or "ai",
        task=task,
        site_url=site_url,
        persona=persona_dict,
        steps=steps_raw,
        scorecard=scorecard,
        journey_type=body.journeyType or "ux_audit",
        journey_name=body.journeyName,
        locale=body.locale,
        retrieval_usage_user_id=getattr(current_user, "plexon_user_id", None) or str(current_user.id),
    )

    organization_uuid = _ensure_organization_id(body.organizationId)
    target_group_uuid = _resolve_target_group(session, persona=persona, override_id=body.targetGroupId)
    project_uuid = _resolve_project_id(persona, body.projectId)

    if project_uuid is None:
        raise HTTPException(
            status_code=400,
            detail="project_id is required (provide projectId or use a persona linked to a project).",
        )

    allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
    if allowed_project_ids is not None and project_uuid not in allowed_project_ids:
        raise HTTPException(status_code=403, detail="Project access denied")

    saved_journey = _journey_service.save_journey_draft(
        draft=draft,
        target_group_id=target_group_uuid,
        organization_id=organization_uuid,
        project_id=project_uuid,
        created_by=str(current_user.id),
    )

    # Backlinks + phase extras (separate session opened by save_journey_draft
    # is already closed; reattach via our endpoint session).
    journey_uuid = saved_journey.id
    try:
        session.execute(
            update(Journey)
            .where(Journey.id == journey_uuid)
            .values(source_ux_journey_run_id=run_row.id if run_row else None)
        )
        if run_row:
            session.execute(
                update(PersonaUxJourneyRun)
                .where(PersonaUxJourneyRun.id == run_row.id)
                .values(derived_journey_id=journey_uuid)
            )
        _persist_phase_extras(session=session, journey_id=journey_uuid, draft=draft)
        session.commit()
    except Exception as exc:  # noqa: BLE001
        session.rollback()
        logger.warning("journey_from_ux_run.backlink_failed", error=str(exc))

    journey_fresh = session.get(Journey, journey_uuid)
    return JourneyFromUxRunResponse(
        journey=to_journey_response(journey_fresh) if journey_fresh else to_journey_response(saved_journey),
        mode=mode_used,
        fallbackUsed=fallback_used,
        alreadyConverted=False,
    )


@router.post(
    "/from-ux-run/preview",
    response_model=JourneyFromUxRunDraftResponse,
    summary="Preview the JourneyDraft from a UX-run without persisting",
)
async def preview_journey_from_ux_run(
    body: JourneyFromUxRunRequest,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JourneyFromUxRunDraftResponse:
    run_row, persona, payload = await _load_source(session, body)
    task, site_url, steps_raw, scorecard = _extract_run_inputs(run_row=run_row, payload=payload)
    persona_dict = _persona_snapshot(persona) if persona else None

    draft, mode_used, fallback_used = await _ux_run_service.convert(
        mode=body.mode or "ai",
        task=task,
        site_url=site_url,
        persona=persona_dict,
        steps=steps_raw,
        scorecard=scorecard,
        journey_type=body.journeyType or "ux_audit",
        journey_name=body.journeyName,
        locale=body.locale,
        retrieval_usage_user_id=getattr(current_user, "plexon_user_id", None) or str(current_user.id),
    )
    return JourneyFromUxRunDraftResponse(
        draft={
            "name": draft.name,
            "description": draft.description,
            "journey_type": draft.journey_type,
            "phases": draft.phases,
        },
        mode=mode_used,
        fallbackUsed=fallback_used,
        persona={"id": persona_dict.get("id") if persona_dict else None, "name": persona_dict.get("name") if persona_dict else None},
        sourceJobId=body.jobId or (run_row.job_id if run_row else None),
    )
