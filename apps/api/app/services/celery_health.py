"""Health check utilities for Celery workers."""
from __future__ import annotations

import structlog

logger = structlog.get_logger(__name__)


def check_worker_available() -> bool:
    """Check if a Celery worker is available and can process tasks."""
    try:
        from app.celery_app import celery_app
        
        inspect = celery_app.control.inspect()
        active_workers = inspect.active()
        registered = inspect.registered()
        
        if not active_workers:
            logger.warning("celery_health.no_workers", message="No active Celery workers found")
            return False
        
        # Check if any worker has the ingest task registered
        for worker_name, tasks in (registered or {}).items():
            if "worker.ingest.ingest_document" in tasks:
                logger.debug("celery_health.worker_available", worker=worker_name)
                return True
        
        logger.warning("celery_health.task_not_registered", message="ingest_document task not registered in any worker")
        return False
    except Exception as exc:
        logger.error("celery_health.check_failed", error=str(exc), exc_info=True)
        return False


