from __future__ import annotations

from pathlib import Path
from uuid import UUID

import structlog

from sqlalchemy import select

from app.db import get_session
from app.models import ProcessingJob
from app.services.ingestion import IngestionService
from app.services.celery_health import check_worker_available
from app.celery_app import celery_app

logger = structlog.get_logger(__name__)
ingestion_service = IngestionService()


@celery_app.task(name="worker.ingest.ingest_document", bind=True, max_retries=0)
def ingest_document(self, document_id: str, file_path: str) -> None:
    logger.info("ingest.task.received", document_id=document_id, file_path=file_path, task_id=self.request.id)
    try:
        # Normalize the file path - remove any duplicate 'uploads' segments
        path_str = str(file_path)
        # Fix double 'uploads/uploads' if present
        if '/uploads/uploads/' in path_str:
            path_str = path_str.replace('/uploads/uploads/', '/uploads/')
        file_path_obj = Path(path_str)
        logger.info("ingest.task.start", document_id=document_id, file_path=str(file_path_obj), normalized_path=str(file_path_obj))
        
        if not file_path_obj.exists():
            logger.error("ingest.task.file_not_found", document_id=document_id, file_path=str(file_path_obj))
            # Update job status to failed
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == UUID(document_id))
                )
                if job:
                    job.status = "failed"
                    job.error = f"File not found: {file_path_obj}"
                    session.commit()
            raise FileNotFoundError(f"File not found: {file_path_obj}")
        
        logger.info("ingest.task.calling_service", document_id=document_id)
        ingestion_service.ingest(document_id=UUID(document_id), file_path=file_path_obj)
        logger.info("ingest.task.completed", document_id=document_id)
    except Exception as exc:
        logger.error("ingest.task.failed", document_id=document_id, error=str(exc), error_type=type(exc).__name__, exc_info=True)
        # Update job status to failed if not already updated by ingestion service
        try:
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == UUID(document_id))
                )
                if job and job.status not in ["failed", "completed"]:
                    job.status = "failed"
                    job.error = str(exc)
                    session.commit()
        except Exception as update_exc:
            logger.error("ingest.task.failed_to_update_job", document_id=document_id, error=str(update_exc))
        raise


def enqueue_ingestion(document_id: str, file_path: str, retry_count: int = 0, max_retries: int = 2) -> None:
    """
    Enqueue ingestion task with retry mechanism for NotRegistered errors.
    Falls back to direct processing if Celery worker is not available.
    
    Args:
        document_id: Document UUID
        file_path: Path to the document file
        retry_count: Current retry attempt (internal use)
        max_retries: Maximum number of retries for NotRegistered errors
    """
    logger.info("enqueue.ingestion.start", document_id=document_id, file_path=file_path, retry_count=retry_count)
    
    # Check if worker is available before trying to enqueue
    if not check_worker_available():
        logger.warning(
            "enqueue.ingestion.worker_not_available",
            document_id=document_id,
            message="Celery worker not available, processing directly",
        )
        # Process directly as fallback
        _process_directly(document_id, file_path)
        return
    
    result = None
    try:
        result = celery_app.send_task(
            "worker.ingest.ingest_document",
            kwargs={"document_id": document_id, "file_path": file_path},
            queue="ingestion",
            routing_key="ingestion",
        )
        logger.info("enqueue.ingestion.sent", document_id=document_id, task_id=result.id, queue="ingestion")
        
        # Check if task failed immediately (e.g., NotRegistered)
        # Wait a short time to see if task fails immediately
        import time
        time.sleep(0.5)
        try:
            task_result = result.get(timeout=1)
            if task_result and hasattr(task_result, 'status') and task_result.status == 'FAILURE':
                error_info = result.info if hasattr(result, 'info') else None
                is_not_registered = (
                    error_info and isinstance(error_info, dict) and 
                    error_info.get('exc_type') == 'NotRegistered'
                ) or (
                    hasattr(result, 'result') and 
                    isinstance(result.result, dict) and
                    result.result.get('exc_type') == 'NotRegistered'
                )
                
                if is_not_registered:
                    logger.warning(
                        "enqueue.ingestion.not_registered",
                        document_id=document_id,
                        task_id=result.id,
                        retry_count=retry_count,
                    )
                    
                    # Update job status
                    with get_session() as session:
                        job = session.scalar(
                            select(ProcessingJob).where(ProcessingJob.document_id == UUID(document_id))
                        )
                        if job:
                            if retry_count < max_retries:
                                # Retry after a short delay
                                import time
                                retry_delay = (retry_count + 1) * 2  # 2s, 4s, 6s
                                logger.info(
                                    "enqueue.ingestion.retrying",
                                    document_id=document_id,
                                    retry_count=retry_count + 1,
                                    delay=retry_delay,
                                )
                                job.error = f"Task not registered, retrying in {retry_delay}s (attempt {retry_count + 1}/{max_retries})"
                                session.commit()
                                
                                # Retry after delay
                                time.sleep(retry_delay)
                                return enqueue_ingestion(document_id, file_path, retry_count=retry_count + 1, max_retries=max_retries)
                            else:
                                # Max retries reached
                                job.status = "failed"
                                job.error = f"Task not registered after {max_retries} retries. Worker may not be running or task not imported."
                                session.commit()
                                logger.error(
                                    "enqueue.ingestion.max_retries_reached",
                                    document_id=document_id,
                                    max_retries=max_retries,
                                )
                                return
                else:
                    # Other failure
                    logger.warning("enqueue.ingestion.task_failed_immediately", document_id=document_id, task_id=result.id)
                    with get_session() as session:
                        job = session.scalar(
                            select(ProcessingJob).where(ProcessingJob.document_id == UUID(document_id))
                        )
                        if job:
                            job.status = "failed"
                            job.error = f"Task failed immediately: {error_info}"
                            session.commit()
                    return
        except Exception:
            # Task is still pending or running, which is fine
            pass
        
    except Exception as exc:
        logger.error("enqueue.ingestion.failed", document_id=document_id, error=str(exc), exc_info=True)
        # Update job status to failed
        with get_session() as session:
            job = session.scalar(
                select(ProcessingJob).where(ProcessingJob.document_id == UUID(document_id))
            )
            if job:
                job.status = "failed"
                job.error = str(exc)
                session.commit()
        raise
    
    with get_session() as session:
        job = session.scalar(
            select(ProcessingJob).where(ProcessingJob.document_id == UUID(document_id))
        )
        if job:
            job.status = "pending"
            job.error = None  # Clear any previous errors
            session.commit()
            logger.info("enqueue.ingestion.job_updated", document_id=document_id, job_status="pending")
        else:
            logger.warning("enqueue.ingestion.job_not_found", document_id=document_id)


def _process_directly(document_id: str, file_path: str) -> None:
    """
    Process ingestion directly without Celery (fallback mechanism).
    
    Args:
        document_id: Document UUID
        file_path: Path to the document file
    """
    logger.info("enqueue.ingestion.processing_directly", document_id=document_id, file_path=file_path)
    
    try:
        file_path_obj = Path(file_path)
        
        if not file_path_obj.exists():
            logger.error("enqueue.ingestion.file_not_found", document_id=document_id, file_path=str(file_path_obj))
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == UUID(document_id))
                )
                if job:
                    job.status = "failed"
                    job.error = f"File not found: {file_path_obj}"
                    session.commit()
            return
        
        # Update job status to processing
        with get_session() as session:
            job = session.scalar(
                select(ProcessingJob).where(ProcessingJob.document_id == UUID(document_id))
            )
            if job:
                job.status = "processing"
                job.progress = 0
                session.commit()
        
        # Process directly
        ingestion_service.ingest(document_id=UUID(document_id), file_path=file_path_obj)
        
        logger.info("enqueue.ingestion.direct_processing_completed", document_id=document_id)
        
    except Exception as exc:
        logger.error(
            "enqueue.ingestion.direct_processing_failed",
            document_id=document_id,
            error=str(exc),
            exc_info=True,
        )
        # Update job status
        try:
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == UUID(document_id))
                )
                if job:
                    job.status = "failed"
                    job.error = str(exc)
                    session.commit()
        except Exception as update_exc:
            logger.error(
                "enqueue.ingestion.failed_to_update_job",
                document_id=document_id,
                error=str(update_exc),
            )

