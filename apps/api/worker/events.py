from __future__ import annotations

from uuid import UUID

import structlog
from celery import signals
from celery.exceptions import NotRegistered

from app.db import get_session
from app.models import ProcessingJob

logger = structlog.get_logger(__name__)


@signals.task_failure.connect
def on_task_failure(sender=None, task_id=None, exception=None, traceback=None, einfo=None, **kwargs):
    """Handle task failures, especially NotRegistered errors."""
    if not task_id:
        return
    
    # Check if it's a NotRegistered error
    is_not_registered = False
    task_name = None
    
    if exception:
        is_not_registered = isinstance(exception, NotRegistered) or "NotRegistered" in str(type(exception)) or "NotRegistered" in str(exception)
        if isinstance(exception, NotRegistered):
            task_name = str(exception)
    
    # Also check the task result for NotRegistered errors
    if not is_not_registered:
        try:
            from app.celery_app import celery_app
            from celery.result import AsyncResult
            
            result = AsyncResult(task_id, app=celery_app)
            if result.ready():
                task_info = result.info
                if isinstance(task_info, dict) and task_info.get('exc_type') == 'NotRegistered':
                    is_not_registered = True
                    task_name = task_info.get('exc_message', ['Unknown'])[0] if isinstance(task_info.get('exc_message'), list) else str(task_info.get('exc_message', 'Unknown'))
        except Exception:
            pass
    
    if is_not_registered:
        logger.error(
            "task.not_registered",
            task_id=task_id,
            task_name=task_name or "unknown",
            exception=str(exception) if exception else "NotRegistered",
        )
        
        # Try to extract document_id from task kwargs
        try:
            from app.celery_app import celery_app
            from celery.result import AsyncResult
            
            result = AsyncResult(task_id, app=celery_app)
            if result.ready():
                # Try to get task metadata from backend
                try:
                    task_meta = celery_app.backend.get_task_meta(task_id)
                    if task_meta:
                        # Try different ways to get kwargs
                        kwargs_data = None
                        if 'kwargs' in task_meta:
                            kwargs_data = task_meta['kwargs']
                        elif 'result' in task_meta and isinstance(task_meta['result'], dict):
                            kwargs_data = task_meta['result'].get('kwargs')
                        
                        if kwargs_data and isinstance(kwargs_data, dict):
                            document_id = kwargs_data.get('document_id')
                            if document_id:
                                _update_job_status_for_not_registered(document_id, task_name or "unknown")
                                return
                except Exception as meta_error:
                    logger.debug("task.failed_to_get_task_meta", task_id=task_id, error=str(meta_error))
        except Exception as e:
            logger.warning("task.failed_to_extract_document_id", task_id=task_id, error=str(e))


def _update_job_status_for_not_registered(document_id: str, task_name: str) -> None:
    """Update job status when task is not registered."""
    try:
        with get_session() as session:
            job = (
                session.query(ProcessingJob)
                .filter(ProcessingJob.document_id == UUID(document_id))
                .first()
            )
            if job and job.status not in ["failed", "completed"]:
                error_msg = f"Task not registered: {task_name}. Worker may not be running or task not imported."
                job.status = "failed"
                job.error = error_msg
                session.commit()
                logger.info(
                    "task.job_updated_not_registered",
                    document_id=document_id,
                    job_id=str(job.id),
                    error=error_msg,
                )
    except Exception as e:
        logger.error(
            "task.failed_to_update_job_not_registered",
            document_id=document_id,
            error=str(e),
            exc_info=True,
        )


@signals.task_sent.connect
def on_task_sent(sender=None, task_id=None, task=None, args=None, kwargs=None, **kwds):
    """Log when a task is sent."""
    if task and "ingest" in task.lower():
        logger.debug("task.sent", task_id=task_id, task=task, kwargs=kwargs)


@signals.task_received.connect
def on_task_received(sender=None, request=None, **kwargs):
    """Log when a task is received by a worker."""
    if request and "ingest" in request.task_name.lower():
        logger.debug("task.received", task_id=request.id, task_name=request.task_name)

