from __future__ import annotations

from pathlib import Path
from uuid import UUID

import structlog

from app.db import get_session
from app.models import ProcessingJob
from app.services.ingestion import IngestionService
from app.celery_app import celery_app

logger = structlog.get_logger(__name__)
ingestion_service = IngestionService()


@celery_app.task(name="worker.ingest.ingest_document")
def ingest_document(document_id: str, file_path: str) -> None:
    ingestion_service.ingest(document_id=UUID(document_id), file_path=Path(file_path))


def enqueue_ingestion(document_id: str, file_path: str) -> None:
    celery_app.send_task(
        "worker.ingest.ingest_document",
        kwargs={"document_id": document_id, "file_path": file_path},
    )
    with get_session() as session:
        job = (
            session.query(ProcessingJob)
            .filter(ProcessingJob.document_id == UUID(document_id))
            .one()
        )
        job.status = "pending"
        session.commit()

