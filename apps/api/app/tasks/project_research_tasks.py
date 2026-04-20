from __future__ import annotations

from datetime import datetime
from uuid import UUID

import structlog

from ..celery_app import celery_app
from ..db import get_session
from ..models import ProjectResearchRun, ProjectResearchRunStatus, ProjectResearchSummary
from ..services.project_research_crawl import CrawlLimits, crawl_project_website
from ..services.project_research_synthesis import (
    synthesize_project_research_summary_en,
    translate_research_summary_en_to_de,
)

logger = structlog.get_logger(__name__)


@celery_app.task(name="project.research.run", bind=True, max_retries=0)
def run_project_research_task(self, run_id: str) -> str:
    logger.info("project.research.task.start", run_id=run_id, task_id=self.request.id)
    rid = UUID(run_id)
    with get_session() as session:
        run = session.get(ProjectResearchRun, rid)
        if not run:
            raise ValueError("research_run_not_found")
        run.status = ProjectResearchRunStatus.running
        run.started_at = datetime.utcnow()
        session.commit()
        session.refresh(run)

    try:
        with get_session() as session:
            run = session.get(ProjectResearchRun, rid)
            if not run:
                raise ValueError("research_run_not_found")
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
            source_payload = [{"url": s.url, "text": s.raw_text or s.text_excerpt or ""} for s in sources]
        summary_en = synthesize_project_research_summary_en(sources=source_payload)
        summary_de = translate_research_summary_en_to_de(summary_en=summary_en)

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
        raise

