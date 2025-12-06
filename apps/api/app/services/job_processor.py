"""Background job processor for handling pending ingestion jobs."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

import structlog

from sqlalchemy import select

from app.db import get_session
from app.models import ProcessingJob, Document
from app.services.ingestion import IngestionService
from app.services.celery_health import check_worker_available

logger = structlog.get_logger(__name__)
ingestion_service = IngestionService()


def process_pending_jobs(max_age_seconds: int = 300) -> int:
    """
    Process pending jobs that are older than max_age_seconds.
    
    This is a fallback mechanism when Celery tasks are not being processed.
    
    Args:
        max_age_seconds: Only process jobs older than this many seconds
        
    Returns:
        Number of jobs processed
    """
    processed_count = 0
    
    try:
        with get_session() as session:
            # Find pending jobs older than max_age_seconds
            cutoff_time = datetime.now(timezone.utc) - timedelta(seconds=max_age_seconds)
            pending_jobs = session.scalars(
                select(ProcessingJob)
                .where(ProcessingJob.status == "pending")
                .where(ProcessingJob.created_at < cutoff_time)
            ).all()
            
            if not pending_jobs:
                return 0
            
            logger.info(
                "job_processor.found_pending_jobs",
                count=len(pending_jobs),
                max_age_seconds=max_age_seconds,
            )
            
            for job in pending_jobs:
                try:
                    # Get document
                    document = session.scalar(
                        select(Document).where(Document.id == job.document_id)
                    )
                    if not document:
                        logger.warning(
                            "job_processor.document_not_found",
                            job_id=str(job.id),
                            document_id=str(job.document_id),
                        )
                        job.status = "failed"
                        job.error = "Document not found"
                        session.commit()
                        continue
                    
                    # Get file path
                    from app.core.config import get_settings
                    settings = get_settings()
                    data_dir = Path(settings.data_dir)
                    file_path = data_dir / document.file_path.lstrip("/")
                    
                    if not file_path.exists():
                        logger.error(
                            "job_processor.file_not_found",
                            job_id=str(job.id),
                            document_id=str(job.document_id),
                            file_path=str(file_path),
                        )
                        job.status = "failed"
                        job.error = f"File not found: {file_path}"
                        session.commit()
                        continue
                    
                    # Check if worker is available - if yes, try to enqueue again
                    if check_worker_available():
                        logger.info(
                            "job_processor.retrying_enqueue",
                            job_id=str(job.id),
                            document_id=str(job.document_id),
                        )
                        # Try to enqueue again
                        from worker.ingest import enqueue_ingestion
                        enqueue_ingestion(str(job.document_id), str(file_path))
                        continue
                    
                    # Worker not available - process directly
                    logger.info(
                        "job_processor.processing_directly",
                        job_id=str(job.id),
                        document_id=str(job.document_id),
                        file_path=str(file_path),
                    )
                    
                    # Update job status to processing
                    job.status = "processing"
                    job.progress = 0
                    session.commit()
                    
                    # Process directly
                    ingestion_service.ingest(document_id=job.document_id, file_path=file_path)
                    
                    processed_count += 1
                    logger.info(
                        "job_processor.job_completed",
                        job_id=str(job.id),
                        document_id=str(job.document_id),
                    )
                    
                except Exception as exc:
                    logger.error(
                        "job_processor.job_failed",
                        job_id=str(job.id),
                        document_id=str(job.document_id),
                        error=str(exc),
                        exc_info=True,
                    )
                    # Update job status
                    try:
                        job.status = "failed"
                        job.error = str(exc)
                        session.commit()
                    except Exception as update_exc:
                        logger.error(
                            "job_processor.failed_to_update_job",
                            job_id=str(job.id),
                            error=str(update_exc),
                        )
                    
    except Exception as exc:
        logger.error("job_processor.process_failed", error=str(exc), exc_info=True)
    
    return processed_count


async def background_job_processor(interval_seconds: int = 30) -> None:
    """
    Background task that periodically processes pending jobs.
    
    Args:
        interval_seconds: How often to check for pending jobs
    """
    logger.info("job_processor.background_task_started", interval_seconds=interval_seconds)
    
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            processed = process_pending_jobs(max_age_seconds=60)  # Process jobs older than 60 seconds
            if processed > 0:
                logger.info("job_processor.processed_jobs", count=processed)
        except Exception as exc:
            logger.error("job_processor.background_task_error", error=str(exc), exc_info=True)
            await asyncio.sleep(interval_seconds)  # Wait before retrying

