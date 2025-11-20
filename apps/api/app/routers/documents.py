from __future__ import annotations

import tempfile
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from udg_glass_proto import UploadJobStatus

from ..db import get_session
from ..models import Document, ProcessingJob
from ..schemas import DocumentUploadResponse
from ..services.storage import StorageService
from worker.ingest import enqueue_ingestion

router = APIRouter(prefix="/documents", tags=["documents"])
storage = StorageService()


def get_db():
    with get_session() as session:
        yield session


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    session: Session = Depends(get_db),
) -> DocumentUploadResponse:
    document = Document(
        filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=file.size or 0,
        status="processing",
    )
    session.add(document)
    session.flush()

    job = ProcessingJob(document_id=document.id, status="pending", progress=0)
    session.add(job)
    session.commit()

    tmp_dir = Path(tempfile.mkdtemp())
    tmp_file = tmp_dir / file.filename
    contents = await file.read()
    tmp_file.write_bytes(contents)

    from io import BytesIO

    storage.upload(
        key=f"documents/{document.id}/{file.filename}",
        data=BytesIO(contents),
        content_type=document.content_type,
    )

    enqueue_ingestion(str(document.id), str(tmp_file))

    return DocumentUploadResponse(job_id=str(job.id))


@router.get("/{job_id}/status")
def job_status(job_id: str, session: Session = Depends(get_db)) -> UploadJobStatus:
    job = session.get(ProcessingJob, job_id)
    if not job:
        return UploadJobStatus(status="failed", reason="Job not found")  # type: ignore[return-value]
    if job.status == "completed":
        return UploadJobStatus(status="completed", document_id=str(job.document_id))  # type: ignore[return-value]
    if job.status == "failed":
        return UploadJobStatus(status="failed", reason=job.error or "Unknown error")  # type: ignore[return-value]
    return UploadJobStatus(status="processing", progress=int(job.progress))  # type: ignore[return-value]

