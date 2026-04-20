from __future__ import annotations

from datetime import datetime
from uuid import UUID

import structlog

from ..celery_app import celery_app
from ..db import get_session
from ..models import ProjectResearchEvent, ProjectResearchRun, ProjectResearchRunStatus, ProjectResearchSource, ProjectResearchSummary
from ..services.project_research_crawl import CrawlLimits, crawl_project_website
from ..services.project_research_synthesis import (
    synthesize_project_research_summary_en,
    translate_research_summary_en_to_de,
)

logger = structlog.get_logger(__name__)


def _emit(
    session,
    *,
    run_id: UUID,
    event_type: str,
    message: str | None = None,
    payload: dict | None = None,
) -> None:
    session.add(
        ProjectResearchEvent(
            run_id=run_id,
            event_type=event_type,
            message=message,
            payload=payload,
            created_at=datetime.utcnow(),
        )
    )
    session.commit()


@celery_app.task(name="project.research.run", bind=True, max_retries=0)
def run_project_research_task(self, run_id: str) -> str:
    logger.info("project.research.task.start", run_id=run_id, task_id=self.request.id)
    rid = UUID(run_id)
    with get_session() as session:
        run = session.get(ProjectResearchRun, rid)
        if not run:
            raise ValueError("research_run_not_found")
        _emit(
            session,
            run_id=run.id,
            event_type="run_queued",
            message="Run created; waiting for worker to start.",
        )
        run.status = ProjectResearchRunStatus.running
        run.started_at = datetime.utcnow()
        session.commit()
        session.refresh(run)
        _emit(
            session,
            run_id=run.id,
            event_type="run_started",
            message="Worker started the research run.",
            payload={"task_id": self.request.id},
        )

    try:
        with get_session() as session:
            run = session.get(ProjectResearchRun, rid)
            if not run:
                raise ValueError("research_run_not_found")
            _emit(session, run_id=run.id, event_type="crawl_start", message="Starting website crawl.")
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
                _emit(
                    session,
                    run_id=run.id,
                    event_type="page_fetched",
                    message=f"Fetched page {i}/{len(sources)}",
                    payload={"url": s.url, "depth": (s.meta or {}).get("depth"), "pages_fetched": i},
                )
            _emit(
                session,
                run_id=run.id,
                event_type="crawl_done",
                message="Crawl completed.",
                payload={"pages_fetched": len(sources)},
            )
            source_payload = [{"url": s.url, "text": s.raw_text or s.text_excerpt or ""} for s in sources]
        with get_session() as session:
            run = session.get(ProjectResearchRun, rid)
            if run:
                _emit(session, run_id=run.id, event_type="synthesize_start", message="Synthesizing research summary (EN).")
        summary_en = synthesize_project_research_summary_en(sources=source_payload)
        with get_session() as session:
            run = session.get(ProjectResearchRun, rid)
            if run:
                _emit(session, run_id=run.id, event_type="synthesize_done", message="Synthesis completed.")
                _emit(session, run_id=run.id, event_type="translate_start", message="Translating summary to German mirror.")
        summary_de = translate_research_summary_en_to_de(summary_en=summary_en)
        with get_session() as session:
            run = session.get(ProjectResearchRun, rid)
            if run:
                _emit(session, run_id=run.id, event_type="translate_done", message="Translation completed.")

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
            session.commit()
            _emit(session, run_id=run.id, event_type="summary_saved", message="Research summary saved.")
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
                session.commit()
                _emit(
                    session,
                    run_id=run.id,
                    event_type="run_failed",
                    message="Research run failed.",
                    payload={"error": str(exc)},
                )
        raise

