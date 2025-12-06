from __future__ import annotations

from pathlib import Path
from uuid import UUID

import structlog

from sqlalchemy import select

from ..celery_app import celery_app
from ..db import get_session
from ..models import ProcessingJob
from ..services.ingestion import IngestionService

logger = structlog.get_logger(__name__)
ingestion_service = IngestionService()


@celery_app.task(name="app.workers.process.process_document")
def process_document(document_id: str, file_path: str) -> None:
    """Process a document: parse, chunk, embed, and store."""
    ingestion_service.ingest(document_id=UUID(document_id), file_path=Path(file_path))


def enqueue_processing(document_id: str, file_path: str) -> None:
    """Enqueue a document for processing."""
    celery_app.send_task(
        "app.workers.process.process_document",
        kwargs={"document_id": document_id, "file_path": file_path},
    )
    with get_session() as session:
        job = session.scalar(
            select(ProcessingJob).where(ProcessingJob.document_id == UUID(document_id))
        )
        if job:
            job.status = "pending"
            session.commit()

