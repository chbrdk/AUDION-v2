from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..celery_app import celery_app
from ..models import Document, Persona, ProcessingJob, TargetGroup
from ..schemas import (
    CeleryTaskStatus,
    LogEntry,
    LogListResponse,
    ProcessingJobDetailResponse,
    ProcessingJobListItem,
    ProcessingJobListResponse,
    QueueStatsResponse,
)
from ..services.celery_health import check_worker_available


class QueueService:
    def list_processing_jobs(
        self,
        session: Session,
        status: str | None = None,
        document_id: str | None = None,
        project_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> ProcessingJobListResponse:
        query = select(ProcessingJob)

        if status:
            query = query.where(ProcessingJob.status == status)

        if document_id:
            try:
                query = query.where(ProcessingJob.document_id == UUID(document_id))
            except ValueError:
                raise ValueError("invalid_document_id")

        if project_id:
            try:
                project_uuid = UUID(project_id)
            except ValueError:
                raise ValueError("invalid_project_id")
            query = (
                query.join(Document, ProcessingJob.document_id == Document.id)
                .outerjoin(Persona, Document.persona_id == Persona.id)
                .outerjoin(TargetGroup, Document.target_group_id == TargetGroup.id)
                .where(
                    or_(
                        Persona.project_id == project_uuid,
                        TargetGroup.project_id == project_uuid,
                    )
                )
            )

        if date_from:
            query = query.where(ProcessingJob.created_at >= date_from)

        if date_to:
            query = query.where(ProcessingJob.created_at <= date_to)

        total = session.scalar(select(func.count()).select_from(query.subquery()))
        items = session.scalars(
            query.order_by(ProcessingJob.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()

        list_items = [
            ProcessingJobListItem(
                id=str(job.id),
                document_id=str(job.document_id),
                status=job.status,
                progress=job.progress,
                error=job.error,
                created_at=job.created_at,
                updated_at=job.updated_at,
            )
            for job in items
        ]

        return ProcessingJobListResponse(
            items=list_items,
            total=total or 0,
            page=page,
            page_size=page_size,
        )

    def get_processing_job(
        self,
        session: Session,
        job_id: str,
        *,
        project_id: str | None = None,
    ) -> ProcessingJobDetailResponse:
        try:
            job_uuid = UUID(job_id)
        except ValueError:
            raise ValueError("invalid_job_id")

        job = session.get(ProcessingJob, job_uuid)
        if not job:
            raise ValueError("job_not_found")

        document = session.get(Document, job.document_id)
        if project_id and document:
            try:
                project_uuid = UUID(project_id)
            except ValueError:
                raise ValueError("invalid_project_id")
            persona_project_id = None
            target_group_project_id = None
            if document.persona_id:
                persona = session.get(Persona, document.persona_id)
                persona_project_id = persona.project_id if persona else None
            if document.target_group_id:
                target_group = session.get(TargetGroup, document.target_group_id)
                target_group_project_id = target_group.project_id if target_group else None
            if project_uuid not in {persona_project_id, target_group_project_id}:
                raise ValueError("job_not_found")
        document_filename = document.filename if document else None
        document_size_bytes = document.size_bytes if document else None

        # Try to get celery_task_id from Redis if available
        celery_task_id = None
        # For now, we don't store celery_task_id in the DB, but we can search Redis
        # This is a simplified version - in production, you'd want to store task_id in DB

        return ProcessingJobDetailResponse(
            id=str(job.id),
            document_id=str(job.document_id),
            document_filename=document_filename,
            document_size_bytes=document_size_bytes,
            status=job.status,
            progress=job.progress,
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
            celery_task_id=celery_task_id,
        )

    def get_celery_task_status(self, task_id: str) -> CeleryTaskStatus | None:
        """Get Celery task status from Redis backend."""
        try:
            result = celery_app.AsyncResult(task_id)
            task_state = result.state

            # Get task info
            task_info = result.info if hasattr(result, "info") else None

            # Parse error if task failed
            error = None
            traceback = None
            if task_state == "FAILURE":
                if isinstance(task_info, dict):
                    error = task_info.get("exc_type", "") + ": " + str(task_info.get("exc_message", ""))
                    traceback = task_info.get("traceback")
                elif isinstance(task_info, Exception):
                    error = str(task_info)
            elif task_state == "SUCCESS":
                # Task completed successfully
                pass

            # Get timestamps from task metadata (if available)
            started_at = None
            completed_at = None

            return CeleryTaskStatus(
                task_id=task_id,
                status=task_state,
                result=task_info if task_state == "SUCCESS" else None,
                error=error,
                traceback=traceback,
                started_at=started_at,
                completed_at=completed_at,
            )
        except Exception:
            return None

    def get_queue_stats(self, session: Session, project_id: str | None = None) -> QueueStatsResponse:
        """Get queue statistics."""
        pending_query = select(func.count(ProcessingJob.id)).where(ProcessingJob.status == "pending")
        processing_query = select(func.count(ProcessingJob.id)).where(ProcessingJob.status == "processing")
        completed_query = select(func.count(ProcessingJob.id)).where(ProcessingJob.status == "completed")
        failed_query = select(func.count(ProcessingJob.id)).where(ProcessingJob.status == "failed")

        if project_id:
            try:
                project_uuid = UUID(project_id)
            except ValueError:
                raise ValueError("invalid_project_id")
            def apply_project_filter(query):
                return (
                    query.select_from(ProcessingJob)
                    .join(Document, ProcessingJob.document_id == Document.id)
                    .outerjoin(Persona, Document.persona_id == Persona.id)
                    .outerjoin(TargetGroup, Document.target_group_id == TargetGroup.id)
                    .where(
                        or_(
                            Persona.project_id == project_uuid,
                            TargetGroup.project_id == project_uuid,
                        )
                    )
                )

            pending_query = apply_project_filter(pending_query)
            processing_query = apply_project_filter(processing_query)
            completed_query = apply_project_filter(completed_query)
            failed_query = apply_project_filter(failed_query)

        pending_count = session.scalar(pending_query) or 0
        processing_count = session.scalar(processing_query) or 0
        completed_count = session.scalar(completed_query) or 0
        failed_count = session.scalar(failed_query) or 0

        worker_available = check_worker_available()

        # Get worker count
        worker_count = 0
        try:
            inspect = celery_app.control.inspect()
            active_workers = inspect.active()
            if active_workers:
                worker_count = len(active_workers)
        except Exception:
            pass

        return QueueStatsResponse(
            pending_count=pending_count,
            processing_count=processing_count,
            completed_count=completed_count,
            failed_count=failed_count,
            worker_available=worker_available,
            worker_count=worker_count,
        )

    def get_recent_logs(
        self,
        session: Session,
        level: str | None = None,
        job_id: str | None = None,
        document_id: str | None = None,
        page: int = 1,
        page_size: int = 50,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> LogListResponse:
        """
        Get recent log entries.
        
        Note: This is a simplified implementation. In production, you'd want to:
        - Query from structured log storage (Logfire, Elasticsearch, etc.)
        - Parse structured logs from files
        - Use log aggregation service
        
        For now, we return empty logs since we don't have a log storage backend.
        """
        # TODO: Implement log retrieval from Logfire or structured log storage
        # For now, return empty response
        return LogListResponse(
            items=[],
            total=0,
            page=page,
            page_size=page_size,
        )

    def retry_failed_job(
        self,
        session: Session,
        job_id: str,
        *,
        project_id: str | None = None,
    ) -> ProcessingJobDetailResponse:
        """Retry a failed processing job."""
        try:
            job_uuid = UUID(job_id)
        except ValueError:
            raise ValueError("invalid_job_id")

        job = session.get(ProcessingJob, job_uuid)
        if not job:
            raise ValueError("job_not_found")
        if project_id:
            # Ensure access before mutating state
            self.get_processing_job(session, job_id, project_id=project_id)

        if job.status != "failed":
            raise ValueError("job_not_failed")

        # Get document
        document = session.get(Document, job.document_id)
        if not document:
            raise ValueError("document_not_found")

        # Get file path
        from pathlib import Path
        from ..core.config import get_settings

        settings = get_settings()
        data_dir = Path(settings.data_dir)
        file_path = data_dir / document.file_path.lstrip("/")

        if not file_path.exists():
            raise ValueError("file_not_found")

        # Reset job status
        job.status = "pending"
        job.progress = 0.0
        job.error = None
        session.commit()

        # Enqueue ingestion again
        from worker.ingest import enqueue_ingestion

        enqueue_ingestion(str(job.document_id), str(file_path))

        return self.get_processing_job(session, job_id, project_id=project_id)
