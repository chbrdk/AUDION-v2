from __future__ import annotations

import json
from datetime import datetime
from uuid import UUID, uuid4

import structlog

from ..celery_app import celery_app
from ..db import get_session
from sqlalchemy import func, select, text

from ..core.config import get_settings
from ..models import (
    Project,
    ProjectResearchEvent,
    ProjectResearchRun,
    ProjectResearchRunStatus,
    ProjectResearchSource,
    ProjectResearchSummary,
)
from ..services.checkion_deep_scan_client import (
    fetch_checkion_page_metadata_for_research,
    normalize_url_match_key,
)
from ..services.project_research_crawl import CrawlLimits, crawl_project_website
from ..services.project_research_synthesis import (
    synthesize_project_research_summary_en,
    translate_research_summary_en_to_de,
)

logger = structlog.get_logger(__name__)


def _max_event_seq(session, *, run_id: UUID) -> int:
    try:
        has_seq = bool(
            session.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'audion'
                      AND table_name = 'project_research_events'
                      AND column_name = 'seq'
                    LIMIT 1
                    """
                )
            ).scalar()
        )
    except Exception:
        has_seq = False

    if not has_seq:
        return 0

    val = session.scalar(
        select(func.coalesce(func.max(ProjectResearchEvent.seq), 0)).where(ProjectResearchEvent.run_id == run_id)
    )
    return int(val or 0)


def _emit(
    session,
    *,
    run_id: UUID,
    seq: int,
    event_type: str,
    message: str | None = None,
    payload: dict | None = None,
) -> None:
    try:
        has_seq = bool(
            session.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'audion'
                      AND table_name = 'project_research_events'
                      AND column_name = 'seq'
                    LIMIT 1
                    """
                )
            ).scalar()
        )
    except Exception:
        has_seq = False

    if has_seq:
        session.add(
            ProjectResearchEvent(
                run_id=run_id,
                seq=seq,
                event_type=event_type,
                message=message,
                payload=payload,
                created_at=datetime.utcnow(),
            )
        )
    else:
        # Legacy DBs that were stamped but not migrated yet (no `seq` column).
        session.execute(
            text(
                """
                INSERT INTO audion.project_research_events
                  (id, run_id, event_type, message, payload, created_at)
                VALUES
                  (:id, :run_id, :event_type, :message, CAST(:payload AS jsonb), :created_at)
                """
            ),
            {
                "id": str(uuid4()),
                "run_id": str(run_id),
                "event_type": event_type,
                "message": message,
                "payload": None if payload is None else json.dumps(payload, ensure_ascii=False),
                "created_at": datetime.utcnow(),
            },
        )


@celery_app.task(name="project.research.run", bind=True, max_retries=0)
def run_project_research_task(self, run_id: str) -> str:
    logger.info("project.research.task.start", run_id=run_id, task_id=self.request.id)
    rid = UUID(run_id)
    with get_session() as session:
        run = session.get(ProjectResearchRun, rid)
        if not run:
            raise ValueError("research_run_not_found")
        seq = _max_event_seq(session, run_id=run.id)
        run.status = ProjectResearchRunStatus.running
        run.started_at = datetime.utcnow()
        session.commit()
        session.refresh(run)
        seq += 1
        _emit(
            session,
            run_id=run.id,
            seq=seq,
            event_type="run_started",
            message="Worker started the research run.",
            payload={"task_id": self.request.id},
        )
        session.commit()

    try:
        with get_session() as session:
            run = session.get(ProjectResearchRun, rid)
            if not run:
                raise ValueError("research_run_not_found")
            seq = _max_event_seq(session, run_id=run.id)
            seq += 1
            _emit(session, run_id=run.id, seq=seq, event_type="crawl_start", message="Starting website crawl.")
            limits = CrawlLimits()
            raw_limits = run.crawl_limits if isinstance(run.crawl_limits, dict) else {}
            if isinstance(raw_limits.get("max_pages"), int):
                limits = CrawlLimits(
                    max_pages=max(1, min(50, int(raw_limits["max_pages"]))),
                    max_depth=limits.max_depth,
                    per_page_max_bytes=limits.per_page_max_bytes,
                    per_page_max_chars=limits.per_page_max_chars,
                    request_timeout_seconds=limits.request_timeout_seconds,
                )
            if isinstance(raw_limits.get("max_depth"), int):
                limits = CrawlLimits(
                    max_pages=limits.max_pages,
                    max_depth=max(0, min(4, int(raw_limits["max_depth"]))),
                    per_page_max_bytes=limits.per_page_max_bytes,
                    per_page_max_chars=limits.per_page_max_chars,
                    request_timeout_seconds=limits.request_timeout_seconds,
                )
            sources = crawl_project_website(session, run=run, seed_url=run.seed_url, limits=limits)
            # Emit page_fetched events (best-effort; small payload)
            for i, s in enumerate(sources, start=1):
                seq += 1
                _emit(
                    session,
                    run_id=run.id,
                    seq=seq,
                    event_type="page_fetched",
                    message=f"Fetched page {i}/{len(sources)}",
                    payload={"url": s.url, "depth": (s.meta or {}).get("depth"), "pages_fetched": i},
                )
                if i % 10 == 0:
                    session.commit()
            seq += 1
            _emit(
                session,
                run_id=run.id,
                seq=seq,
                event_type="crawl_done",
                message="Crawl completed.",
                payload={"pages_fetched": len(sources)},
            )
            session.commit()
            source_payload = [{"url": s.url, "text": s.raw_text or s.text_excerpt or ""} for s in sources]

            settings = get_settings()
            base = (settings.checkion_api_base_url or "").strip()
            token = (settings.checkion_api_token or "").strip()
            if base and token:
                proj = session.get(Project, run.project_id)
                checkion_pid = getattr(proj, "checkion_project_id", None) if proj else None
                try:
                    checkion_map = fetch_checkion_page_metadata_for_research(
                        base_url=base,
                        token=token,
                        seed_url=run.seed_url or "",
                        checkion_project_id=checkion_pid,
                        timeout_seconds=float(settings.checkion_request_timeout_seconds or 30.0),
                    )
                    merged = 0
                    for row in source_payload:
                        key = normalize_url_match_key(str(row.get("url") or ""))
                        meta = checkion_map.get(key)
                        if meta:
                            row["checkion_page"] = meta
                            merged += 1
                    logger.info(
                        "project.research.checkion_merged",
                        run_id=str(run.id),
                        checkion_project_id=checkion_pid,
                        slim_pages_with_payload=len(checkion_map),
                        sources_matched=merged,
                    )
                except Exception as exc:
                    logger.warning("project.research.checkion_skipped", run_id=str(run.id), error=str(exc))
        with get_session() as session:
            run = session.get(ProjectResearchRun, rid)
            if run:
                seq = _max_event_seq(session, run_id=run.id) + 1
                _emit(session, run_id=run.id, seq=seq, event_type="synthesize_start", message="Synthesizing research summary (EN).")
                session.commit()
        summary_en = synthesize_project_research_summary_en(sources=source_payload)
        with get_session() as session:
            run = session.get(ProjectResearchRun, rid)
            if run:
                seq = _max_event_seq(session, run_id=run.id)
                seq += 1
                _emit(session, run_id=run.id, seq=seq, event_type="synthesize_done", message="Synthesis completed.")
                seq += 1
                _emit(session, run_id=run.id, seq=seq, event_type="translate_start", message="Translating summary to German mirror.")
                session.commit()
        summary_de = translate_research_summary_en_to_de(summary_en=summary_en)
        with get_session() as session:
            run = session.get(ProjectResearchRun, rid)
            if run:
                seq = _max_event_seq(session, run_id=run.id) + 1
                _emit(session, run_id=run.id, seq=seq, event_type="translate_done", message="Translation completed.")
                session.commit()

        with get_session() as session:
            run = session.get(ProjectResearchRun, rid)
            if not run:
                raise ValueError("research_run_not_found")
            session.add(
                ProjectResearchSummary(
                    run_id=run.id,
                    summary_en=summary_en,
                    summary_de=summary_de,
                    citations=None,
                    model=(summary_en.get("meta") or {}).get("model"),
                    usage=None,
                    created_at=datetime.utcnow(),
                )
            )
            run.status = ProjectResearchRunStatus.succeeded
            run.finished_at = datetime.utcnow()
            seq = _max_event_seq(session, run_id=run.id) + 1
            _emit(session, run_id=run.id, seq=seq, event_type="summary_saved", message="Research summary saved.")
            session.commit()
        logger.info("project.research.task.succeeded", run_id=run_id, task_id=self.request.id)
        return run_id
    except Exception as exc:  # noqa: BLE001
        logger.error("project.research.task.failed", run_id=run_id, error=str(exc), task_id=self.request.id, exc_info=True)
        with get_session() as session:
            run = session.get(ProjectResearchRun, rid)
            if run:
                run.status = ProjectResearchRunStatus.failed
                run.error = str(exc)
                run.finished_at = datetime.utcnow()
                seq = _max_event_seq(session, run_id=run.id) + 1
                _emit(
                    session,
                    run_id=run.id,
                    seq=seq,
                    event_type="run_failed",
                    message="Research run failed.",
                    payload={"error": str(exc)},
                )
                session.commit()
        raise

