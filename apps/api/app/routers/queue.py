from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import User
from ..schemas import (
    CeleryTaskStatus,
    LogListResponse,
    ProcessingJobDetailResponse,
    ProcessingJobListResponse,
    QueueStatsResponse,
    ServiceStatusResponse,
)
from ..services.queue_store import QueueService
from ..services.service_status import ServiceStatusService
from ..services.auth import get_current_user
from ..services.access_control import list_accessible_project_ids

router = APIRouter(prefix="/queue", tags=["queue"])
service = QueueService()
service_status_service = ServiceStatusService()


def get_db(current_user: User = Depends(get_current_user)):
    with get_session() as session:
        session.info["current_user_id"] = current_user.id
        session.info["allowed_project_ids"] = list_accessible_project_ids(session, current_user.id)
        yield session


@router.get(
    "/jobs",
    response_model=ProcessingJobListResponse,
    summary="List processing jobs with filtering and pagination",
    description="""
    Retrieve a paginated list of document processing jobs with optional filtering capabilities.
    
    This endpoint allows you to search and filter through all processing jobs in the queue.
    Processing jobs track the status of document ingestion operations including text extraction,
    chunking, embedding generation, and storage in the vector database.
    
    **Parameters:**
    - `status`: Filter jobs by status - "pending", "processing", "completed", or "failed" (optional)
    - `document_id`: Filter jobs by associated document ID (optional)
    - `page`: Page number for pagination (default: 1, minimum: 1)
    - `page_size`: Number of items per page (default: 20, minimum: 1, maximum: 100)
    - `date_from`: Filter jobs created after this date/time (optional, ISO 8601 format)
    - `date_to`: Filter jobs created before this date/time (optional, ISO 8601 format)
    
    **Returns:**
    - A paginated list of processing jobs including total count, current page, and page size.
    Each job includes its ID, status, progress, document ID, creation time, and completion/error information.
    
    **Note:** Jobs are sorted by creation date (newest first) by default. Use status filtering
    to monitor job queues and identify failed or stuck jobs.
    """
)
def list_processing_jobs(
    status: str | None = Query(None, description="Filter by job status"),
    document_id: str | None = Query(None, description="Filter by document ID"),
    project_id: str | None = Query(None, description="Filter by project ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: datetime | None = Query(None, description="Filter jobs created after this date"),
    date_to: datetime | None = Query(None, description="Filter jobs created before this date"),
    session: Session = Depends(get_db),
) -> ProcessingJobListResponse:
    try:
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
        if allowed_project_ids is not None:
            try:
                project_uuid = UUID(project_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid project_id") from exc
            if project_uuid not in allowed_project_ids:
                raise HTTPException(status_code=403, detail="Project access denied")
        return service.list_processing_jobs(
            session,
            status=status,
            document_id=document_id,
            project_id=project_id,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/jobs/{job_id}",
    response_model=ProcessingJobDetailResponse,
    summary="Get details of a specific processing job",
    description="""
    Retrieve comprehensive details of a specific document processing job by its ID.
    
    This endpoint returns all information about a processing job including its current status,
    progress percentage, associated document, timestamps, error details if failed, and
    the Celery task ID if available.
    
    **Parameters:**
    - `job_id`: The unique identifier of the processing job (UUID format)
    
    **Returns:**
    - Complete processing job details including:
      - Job ID and current status (pending, processing, completed, failed)
      - Progress percentage (0-100)
      - Associated document ID
      - Creation and completion timestamps
      - Error message and details if the job failed
      - Celery task ID (if available)
      - Processing metadata
    
    **Note:** Use this endpoint to check the status of a specific job, monitor progress,
    or retrieve error information for failed jobs. Returns 404 if the job ID is not found.
    """
)
def get_processing_job(
    job_id: str,
    project_id: str | None = Query(None),
    session: Session = Depends(get_db),
) -> ProcessingJobDetailResponse:
    try:
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
        if allowed_project_ids is not None:
            try:
                project_uuid = UUID(project_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid project_id") from exc
            if project_uuid not in allowed_project_ids:
                raise HTTPException(status_code=403, detail="Project access denied")
        return service.get_processing_job(session, job_id, project_id=project_id)
    except ValueError as exc:
        if "not found" in str(exc):
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/jobs/{job_id}/task",
    response_model=CeleryTaskStatus,
    summary="Get Celery task status for a job",
    description="""
    Retrieve the current status of the Celery task associated with a processing job.
    
    This endpoint provides low-level Celery task information including task state, result,
    traceback (if failed), and task metadata. Useful for debugging and monitoring the
    underlying asynchronous task execution.
    
    **Parameters:**
    - `job_id`: The unique identifier of the processing job (UUID format)
    
    **Returns:**
    - Celery task status object containing:
      - Task ID
      - Task state (PENDING, STARTED, SUCCESS, FAILURE, RETRY, REVOKED, etc.)
      - Task result (if completed)
      - Traceback information (if failed)
      - Task metadata and timestamps
    
    **Note:** Returns 404 if the job doesn't have an associated Celery task ID or if
    the task is not found in Celery. Not all jobs may have Celery tasks associated
    with them. The job must exist first before checking its task status.
    """
)
def get_celery_task_status(
    job_id: str,
    project_id: str | None = Query(None),
    session: Session = Depends(get_db),
) -> CeleryTaskStatus:
    try:
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
        if allowed_project_ids is not None:
            try:
                project_uuid = UUID(project_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid project_id") from exc
            if project_uuid not in allowed_project_ids:
                raise HTTPException(status_code=403, detail="Project access denied")
        job = service.get_processing_job(session, job_id, project_id=project_id)
        # Try to get celery task ID from job
        # For now, we don't store task_id in DB, so we return None if not available
        if not job.celery_task_id:
            raise HTTPException(
                status_code=404, detail="Celery task ID not available for this job"
            )
        
        task_status = service.get_celery_task_status(job.celery_task_id)
        if not task_status:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return task_status
    except HTTPException:
        raise
    except ValueError as exc:
        if "not found" in str(exc):
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/stats",
    response_model=QueueStatsResponse,
    summary="Get queue statistics (pending, processing, completed, failed counts)",
    description="""
    Retrieve aggregate statistics about the processing queue.
    
    This endpoint provides an overview of the current state of the processing queue
    by counting jobs in different status categories. Useful for monitoring system health,
    identifying bottlenecks, and tracking overall processing performance.
    
    **Parameters:**
    - None (no query parameters required)
    
    **Returns:**
    - Queue statistics object containing counts for:
      - Total number of jobs
      - Number of pending jobs (queued, waiting to be processed)
      - Number of processing jobs (currently being executed)
      - Number of completed jobs (successfully finished)
      - Number of failed jobs (encountered errors)
    
    **Note:** Statistics are calculated in real-time from the database. Use this endpoint
    for dashboard displays, monitoring alerts, or performance metrics. High numbers of
    failed or pending jobs may indicate system issues that need attention.
    """
)
def get_queue_stats(
    project_id: str | None = Query(None),
    session: Session = Depends(get_db),
) -> QueueStatsResponse:
    try:
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
        if allowed_project_ids is not None:
            try:
                project_uuid = UUID(project_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid project_id") from exc
            if project_uuid not in allowed_project_ids:
                raise HTTPException(status_code=403, detail="Project access denied")
        return service.get_queue_stats(session, project_id=project_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post(
    "/jobs/{job_id}/retry",
    response_model=ProcessingJobDetailResponse,
    summary="Retry a failed processing job",
    description="""
    Retry a processing job that previously failed or is stuck in processing state.
    
    This endpoint resets a failed job's status and re-enqueues it for processing.
    Useful when a job failed due to transient errors (network issues, temporary service
    unavailability) or when a job appears to be stuck in a processing state.
    
    **Parameters:**
    - `job_id`: The unique identifier of the processing job to retry (UUID format)
    
    **Returns:**
    - The updated processing job object with reset status ("processing") and cleared error information.
    
    **Note:** Only jobs with status "failed" can be retried. Attempting to retry a job
    with another status will return a 404 error. The job is immediately re-enqueued for
    processing after the status is reset. Use with caution on jobs that may have failed
    due to persistent issues (invalid document format, etc.) as they may fail again.
    """
)
def retry_failed_job(
    job_id: str,
    project_id: str | None = Query(None),
    session: Session = Depends(get_db),
) -> ProcessingJobDetailResponse:
    try:
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
        if allowed_project_ids is not None:
            try:
                project_uuid = UUID(project_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid project_id") from exc
            if project_uuid not in allowed_project_ids:
                raise HTTPException(status_code=403, detail="Project access denied")
        return service.retry_failed_job(session, job_id, project_id=project_id)
    except ValueError as exc:
        if "not found" in str(exc) or "not_failed" in str(exc):
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/logs",
    response_model=LogListResponse,
    summary="Get recent processing logs with filtering",
    description="""
    Retrieve a paginated list of recent processing logs with optional filtering capabilities.
    
    This endpoint allows you to search and filter through application logs related to document
    processing operations. Logs include information about job execution, errors, warnings,
    and debug messages that help troubleshoot processing issues.
    
    **Parameters:**
    - `level`: Filter logs by level - "DEBUG", "INFO", "WARNING", or "ERROR" (optional)
    - `job_id`: Filter logs related to a specific processing job (optional)
    - `document_id`: Filter logs related to a specific document (optional)
    - `page`: Page number for pagination (default: 1, minimum: 1)
    - `page_size`: Number of items per page (default: 50, minimum: 1, maximum: 200)
    - `date_from`: Filter logs created after this date/time (optional, ISO 8601 format)
    - `date_to`: Filter logs created before this date/time (optional, ISO 8601 format)
    
    **Returns:**
    - A paginated list of log entries including total count, current page, and page size.
    Each log entry includes its level, message, timestamp, job ID, document ID, and
    additional metadata.
    
    **Note:** Logs are sorted by timestamp (newest first) by default. Use this endpoint
    to debug processing issues, monitor system behavior, or audit processing operations.
    Logs are stored in the database and may be subject to retention policies.
    """
)
def get_recent_logs(
    level: str | None = Query(None, description="Filter by log level (DEBUG, INFO, WARNING, ERROR)"),
    job_id: str | None = Query(None, description="Filter by job ID"),
    document_id: str | None = Query(None, description="Filter by document ID"),
    project_id: str | None = Query(None, description="Filter by project ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    date_from: datetime | None = Query(None, description="Filter logs after this date"),
    date_to: datetime | None = Query(None, description="Filter logs before this date"),
    session: Session = Depends(get_db),
) -> LogListResponse:
    try:
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required")
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
        if allowed_project_ids is not None:
            try:
                project_uuid = UUID(project_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid project_id") from exc
            if project_uuid not in allowed_project_ids:
                raise HTTPException(status_code=403, detail="Project access denied")
        return service.get_recent_logs(
            session,
            level=level,
            job_id=job_id,
            document_id=document_id,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get(
    "/service-status",
    response_model=ServiceStatusResponse,
    summary="Get status of all system services",
    description="""
    Retrieve the health status of all system services including databases, APIs, and infrastructure.
    
    This endpoint checks the connectivity and health of:
    - PostgreSQL database
    - Redis cache/queue
    - Qdrant vector database
    - Neo4j graph database
    - Tempo observability
    - Indexing API
    - Chat API
    - Persona API (this service)
    - Web frontend
    - Nginx reverse proxy
    
    **Returns:**
    - List of service statuses with name, status (up/down/unknown), and optional message
    - Overall indicator if all critical services are up
    
    **Note:** Service checks have a 2-second timeout. Some services may be marked as "unknown"
    if they are not configured or unreachable.
    """
)
async def get_service_status() -> ServiceStatusResponse:
    try:
        return await service_status_service.get_service_status()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
