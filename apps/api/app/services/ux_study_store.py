"""CRUD helpers for UX Studies / Waves."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import UxStudy, UxStudyWave, UxWaveRunItem
from ..ux_study_schemas import (
    HypothesisTemplate,
    UxStudyCreate,
    UxStudyDetailOut,
    UxStudyListOut,
    UxStudyPatch,
    UxStudySummaryOut,
    UxWaveCreate,
    UxWaveDetailOut,
    UxWaveRunItemOut,
    UxWaveSummaryOut,
)
from .ux_study_evaluate import build_evaluation, compare_evaluations


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _run_out(item: UxWaveRunItem) -> UxWaveRunItemOut:
    return UxWaveRunItemOut(
        id=item.id,
        run_key=item.run_key,
        leitfaden_block=item.leitfaden_block,
        persona_id=item.persona_id,
        persona_name=item.persona_name,
        segment=item.segment,
        url=item.url,
        task=item.task,
        max_steps=item.max_steps,
        job_id=item.job_id,
        agent_status=item.agent_status,
        agent_success=item.agent_success,
        task_completed=item.task_completed,
        valid_evidence=item.valid_evidence,
        valid_evidence_caveat=item.valid_evidence_caveat,
        blockers=list(item.blockers or []),
        steps=item.steps,
        friction_score=item.friction_score,
        persona_fit_score=item.persona_fit_score,
        goal_reached=item.goal_reached,
        finding=item.finding,
        categories=dict(item.categories or {}),
    )


def _wave_summary(wave: UxStudyWave) -> UxWaveSummaryOut:
    runs = list(wave.run_items or [])
    return UxWaveSummaryOut(
        id=wave.id,
        wave_key=wave.wave_key,
        status=wave.status,
        study_id=wave.study_id,
        run_count=len(runs),
        valid_evidence_count=sum(1 for r in runs if r.valid_evidence is True),
        updated_at=_iso(wave.updated_at),
    )


def _wave_detail(wave: UxStudyWave) -> UxWaveDetailOut:
    summary = _wave_summary(wave)
    return UxWaveDetailOut(
        **summary.model_dump(),
        evaluation=wave.evaluation,
        runs=[_run_out(r) for r in (wave.run_items or [])],
    )


def _study_summary(study: UxStudy) -> UxStudySummaryOut:
    waves = list(study.waves or [])
    return UxStudySummaryOut(
        id=study.id,
        name=study.name,
        status=study.status,
        project_id=study.project_id,
        source_guide=study.source_guide,
        target_url_key=study.target_url_key,
        wave_count=len(waves),
        updated_at=_iso(study.updated_at),
    )


def _study_detail(study: UxStudy) -> UxStudyDetailOut:
    templates = []
    for t in study.hypothesis_templates or []:
        if isinstance(t, dict) and t.get("id"):
            templates.append(HypothesisTemplate(id=str(t["id"]), statement=str(t.get("statement") or "")))
    return UxStudyDetailOut(
        **_study_summary(study).model_dump(),
        description=study.description,
        hypothesis_templates=templates,
        waves=[_wave_summary(w) for w in (study.waves or [])],
    )


def list_studies(
    session: Session,
    *,
    page: int = 1,
    page_size: int = 50,
    project_id: UUID | None = None,
) -> UxStudyListOut:
    q = select(UxStudy).options(selectinload(UxStudy.waves)).order_by(UxStudy.updated_at.desc())
    if project_id:
        q = q.where(UxStudy.project_id == project_id)
    studies = list(session.scalars(q).unique().all())
    start = max(0, (page - 1) * page_size)
    slice_ = studies[start : start + page_size]
    return UxStudyListOut(
        items=[_study_summary(s) for s in slice_],
        total=len(studies),
        page=page,
        page_size=page_size,
    )


def get_study(session: Session, study_id: UUID) -> UxStudy | None:
    return session.scalars(
        select(UxStudy)
        .where(UxStudy.id == study_id)
        .options(selectinload(UxStudy.waves).selectinload(UxStudyWave.run_items))
    ).first()


def create_study(session: Session, payload: UxStudyCreate) -> UxStudyDetailOut:
    study = UxStudy(
        id=uuid4(),
        name=payload.name.strip(),
        status=payload.status,
        description=payload.description,
        project_id=payload.project_id,
        source_guide=payload.source_guide,
        target_url_key=payload.target_url_key,
        hypothesis_templates=[t.model_dump() for t in payload.hypothesis_templates],
    )
    session.add(study)
    session.commit()
    session.refresh(study)
    return _study_detail(get_study(session, study.id) or study)


def patch_study(session: Session, study_id: UUID, payload: UxStudyPatch) -> UxStudyDetailOut | None:
    study = get_study(session, study_id)
    if not study:
        return None
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        study.name = str(data["name"]).strip()
    for key in ("status", "description", "project_id", "source_guide", "target_url_key"):
        if key in data:
            setattr(study, key, data[key])
    if "hypothesis_templates" in data and data["hypothesis_templates"] is not None:
        study.hypothesis_templates = data["hypothesis_templates"]
    study.updated_at = datetime.utcnow()
    session.commit()
    return _study_detail(get_study(session, study_id) or study)


def create_wave(session: Session, study_id: UUID, payload: UxWaveCreate) -> UxWaveDetailOut | None:
    study = get_study(session, study_id)
    if not study:
        return None
    wave = UxStudyWave(
        id=uuid4(),
        study_id=study_id,
        wave_key=payload.wave_key.strip(),
        status=payload.status,
    )
    session.add(wave)
    session.flush()
    for r in payload.runs:
        session.add(
            UxWaveRunItem(
                id=uuid4(),
                wave_id=wave.id,
                run_key=r.run_key,
                leitfaden_block=r.leitfaden_block,
                persona_id=r.persona_id,
                persona_name=r.persona_name,
                segment=r.segment,
                url=r.url,
                task=r.task,
                max_steps=r.max_steps,
                job_id=r.job_id,
                agent_status=r.agent_status,
                agent_success=r.agent_success,
                task_completed=r.task_completed,
                valid_evidence=r.valid_evidence,
                valid_evidence_caveat=r.valid_evidence_caveat,
                blockers=r.blockers,
                steps=r.steps,
                friction_score=r.friction_score,
                persona_fit_score=r.persona_fit_score,
                goal_reached=r.goal_reached,
                finding=r.finding,
                categories=r.categories,
            )
        )
    study.updated_at = datetime.utcnow()
    session.commit()
    return get_wave(session, study_id, wave.id)


def get_wave(session: Session, study_id: UUID, wave_id: UUID) -> UxWaveDetailOut | None:
    wave = session.scalars(
        select(UxStudyWave)
        .where(UxStudyWave.id == wave_id, UxStudyWave.study_id == study_id)
        .options(selectinload(UxStudyWave.run_items))
    ).first()
    if not wave:
        return None
    return _wave_detail(wave)


def _runs_as_eval_dicts(wave: UxStudyWave) -> list[dict[str, Any]]:
    out = []
    for r in wave.run_items or []:
        out.append(
            {
                "runId": r.run_key,
                "runKey": r.run_key,
                "validEvidence": r.valid_evidence,
                "taskCompleted": r.task_completed,
                "blockers": list(r.blockers or []),
                "frictionScore": r.friction_score,
                "personaFitScore": r.persona_fit_score,
                "goalReached": r.goal_reached,
                "segment": r.segment,
            }
        )
    return out


def evaluate_wave(session: Session, study_id: UUID, wave_id: UUID) -> UxWaveDetailOut | None:
    wave = session.scalars(
        select(UxStudyWave)
        .where(UxStudyWave.id == wave_id, UxStudyWave.study_id == study_id)
        .options(selectinload(UxStudyWave.run_items))
    ).first()
    if not wave:
        return None
    prior = wave.evaluation if isinstance(wave.evaluation, dict) else {}
    evaluation = build_evaluation(
        study_id=str(study_id),
        wave_id=str(wave_id),
        runs=_runs_as_eval_dicts(wave),
        prior_hypotheses=prior.get("hypotheses"),
        prior_soft=prior.get("softScores"),
        notes=prior.get("notes"),
    )
    wave.evaluation = evaluation
    if wave.status == "draft":
        wave.status = "complete"
    wave.updated_at = datetime.utcnow()
    session.commit()
    return get_wave(session, study_id, wave_id)


def compare_waves(
    session: Session,
    study_id: UUID,
    wave_id: UUID,
    other_wave_id: UUID,
) -> dict[str, Any] | None:
    current = session.scalars(
        select(UxStudyWave)
        .where(UxStudyWave.id == wave_id, UxStudyWave.study_id == study_id)
        .options(selectinload(UxStudyWave.run_items))
    ).first()
    baseline = session.scalars(
        select(UxStudyWave)
        .where(UxStudyWave.id == other_wave_id, UxStudyWave.study_id == study_id)
        .options(selectinload(UxStudyWave.run_items))
    ).first()
    if not current or not baseline:
        return None
    cur_ev = dict(current.evaluation or {})
    base_ev = dict(baseline.evaluation or {})
    cur_ev.setdefault("waveId", str(current.id))
    base_ev.setdefault("waveId", str(baseline.id))
    cur_ev["runs"] = _runs_as_eval_dicts(current)
    base_ev["runs"] = _runs_as_eval_dicts(baseline)
    if not cur_ev.get("aggregate"):
        cur_ev = build_evaluation(
            study_id=str(study_id),
            wave_id=str(current.id),
            runs=cur_ev["runs"],
            prior_hypotheses=cur_ev.get("hypotheses"),
            prior_soft=cur_ev.get("softScores"),
        )
    if not base_ev.get("aggregate"):
        base_ev = build_evaluation(
            study_id=str(study_id),
            wave_id=str(baseline.id),
            runs=base_ev["runs"],
            prior_hypotheses=base_ev.get("hypotheses"),
            prior_soft=base_ev.get("softScores"),
        )
    delta = compare_evaluations(base_ev, cur_ev)
    delta["baselineWaveId"] = str(baseline.id)
    delta["currentWaveId"] = str(current.id)
    return delta
