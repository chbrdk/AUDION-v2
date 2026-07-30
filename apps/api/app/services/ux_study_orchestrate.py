"""Start UX Journey Agent jobs for wave run items."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import UxStudyWave, UxWaveRunItem
from .ux_journey_agent_client import agent_base_url_or_503, fetch_run_payload
from .ux_study_evaluate import apply_agent_result_to_run
from .ux_study_store import get_wave

logger = structlog.get_logger(__name__)


async def start_wave_runs(
    session: Session,
    study_id: UUID,
    wave_id: UUID,
    *,
    sequential: bool = True,
) -> dict[str, Any]:
    """POST /run for each run item missing job_id; mark wave running."""
    wave = session.scalars(
        select(UxStudyWave)
        .where(UxStudyWave.id == wave_id, UxStudyWave.study_id == study_id)
        .options(selectinload(UxStudyWave.run_items))
    ).first()
    if not wave:
        return {"error": "wave_not_found"}

    base, timeout = agent_base_url_or_503()
    wave.status = "running"
    wave.updated_at = datetime.utcnow()
    session.commit()

    started: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    items = list(wave.run_items or [])
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for item in items:
            if item.job_id:
                started.append({"runKey": item.run_key, "jobId": item.job_id, "skipped": True})
                continue
            body = {
                "url": item.url,
                "task": item.task,
                "max_steps": item.max_steps or 30,
            }
            if item.persona_id:
                body["persona_id"] = str(item.persona_id)
            if item.persona_name:
                body["persona"] = item.persona_name
            try:
                res = await client.post(f"{base}/run", json=body)
                if res.status_code >= 400:
                    errors.append(
                        {
                            "runKey": item.run_key,
                            "status": res.status_code,
                            "detail": res.text[:500],
                        }
                    )
                    continue
                payload = res.json()
                job_id = payload.get("jobId") or payload.get("job_id") or payload.get("id")
                item.job_id = str(job_id) if job_id else None
                item.agent_status = payload.get("status") or "queued"
                item.updated_at = datetime.utcnow()
                started.append({"runKey": item.run_key, "jobId": item.job_id})
                if sequential:
                    # leave polling to sync endpoint; start next immediately
                    pass
            except Exception as exc:  # noqa: BLE001
                logger.warning("ux_wave_start_failed", run_key=item.run_key, error=str(exc))
                errors.append({"runKey": item.run_key, "detail": str(exc)})

    session.commit()
    detail = get_wave(session, study_id, wave_id)
    return {
        "wave": detail.model_dump(mode="json") if detail else None,
        "started": started,
        "errors": errors,
    }


async def sync_wave_run_statuses(
    session: Session,
    study_id: UUID,
    wave_id: UUID,
) -> dict[str, Any]:
    """Pull agent status for items with job_id and update evidence fields."""
    wave = session.scalars(
        select(UxStudyWave)
        .where(UxStudyWave.id == wave_id, UxStudyWave.study_id == study_id)
        .options(selectinload(UxStudyWave.run_items))
    ).first()
    if not wave:
        return {"error": "wave_not_found"}

    updated = []
    for item in wave.run_items or []:
        if not item.job_id:
            continue
        try:
            payload = await fetch_run_payload(item.job_id)
        except Exception as exc:  # noqa: BLE001
            updated.append({"runKey": item.run_key, "error": str(exc)})
            continue
        as_dict = {
            "runKey": item.run_key,
            "blockers": list(item.blockers or []),
            "finding": item.finding,
            "jobId": item.job_id,
        }
        merged = apply_agent_result_to_run(as_dict, payload)
        item.agent_status = merged.get("agentStatus")
        item.agent_success = merged.get("agentSuccess")
        item.task_completed = merged.get("taskCompleted")
        item.valid_evidence = merged.get("validEvidence")
        item.valid_evidence_caveat = merged.get("validEvidenceCaveat")
        item.blockers = merged.get("blockers")
        item.steps = merged.get("steps")
        item.friction_score = merged.get("frictionScore")
        item.persona_fit_score = merged.get("personaFitScore")
        item.goal_reached = merged.get("goalReached")
        item.finding = merged.get("finding")
        item.categories = merged.get("categories")
        item.updated_at = datetime.utcnow()
        updated.append({"runKey": item.run_key, "agentStatus": item.agent_status})

    statuses = [i.agent_status for i in (wave.run_items or []) if i.job_id]
    if statuses and all(s in ("complete", "failed", "cancelled", "error") for s in statuses if s):
        wave.status = "complete" if any(
            (i.valid_evidence is True) or (i.agent_status == "complete") for i in (wave.run_items or [])
        ) else "failed"
    wave.updated_at = datetime.utcnow()
    session.commit()
    detail = get_wave(session, study_id, wave_id)
    return {"wave": detail.model_dump(mode="json") if detail else None, "updated": updated}
