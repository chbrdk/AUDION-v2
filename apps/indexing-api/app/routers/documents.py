from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from ..core.exceptions import InvalidFileTypeError
from ..db import get_session
from ..models import Document, ProcessingJob
from ..schemas import DocumentUploadResponse
from udg_glass_proto.uploads import UploadProcessingStatus, UploadCompletedStatus, UploadFailedStatus
from ..services.storage import StorageService
from ..workers.process import enqueue_processing

router = APIRouter(prefix="/documents", tags=["documents"])

# Allowed file types
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE_MB = 100
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

storage = StorageService()


def get_db():
    with get_session() as session:
        yield session


def validate_file_type(filename: str) -> None:
    """Validate that the file type is allowed."""
    file_ext = Path(filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise InvalidFileTypeError(file_ext)


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: UploadFile = File(...),
    session: Session = Depends(get_db),
) -> DocumentUploadResponse:
    """Upload a document for processing."""
    # Validate file type
    if not file.filename:
        raise InvalidFileTypeError("unknown")
    validate_file_type(file.filename)

    # Read file content
    contents = await file.read()

    # Check file size
    if len(contents) > MAX_FILE_SIZE_BYTES:
        from ..core.exceptions import FileTooLargeError
        raise FileTooLargeError(MAX_FILE_SIZE_MB)

    # Create document record
    document = Document(
        filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(contents),
        status="processing",
        file_path="",  # Will be set after saving
    )
    session.add(document)
    session.flush()

    # Save file to local storage
    stored_file = storage.save(
        document_id=document.id,
        filename=file.filename,
        content=contents
    )

    # Update document with file path
    document.file_path = str(stored_file.file_path)
    session.flush()

    # Create processing job
    job = ProcessingJob(document_id=document.id, status="pending", progress=0)
    session.add(job)
    session.commit()

    # Enqueue processing task
    enqueue_processing(str(document.id), str(stored_file.file_path))

    return DocumentUploadResponse(job_id=str(job.id))


@router.get("/jobs/{job_id}/status")
def job_status(job_id: str, session: Session = Depends(get_db)):
    """Get the status of a processing job."""
    if not job_id or job_id == "undefined" or job_id.strip() == "":
        return UploadFailedStatus(reason="Invalid job ID: job ID is required")
    
    try:
        job_uuid = UUID(job_id)
    except ValueError:
        return UploadFailedStatus(reason=f"Invalid job ID format: {job_id}")

    job = session.get(ProcessingJob, job_uuid)
    if not job:
        return UploadFailedStatus(reason="Job not found")

    if job.status == "completed":
        return UploadCompletedStatus(document_id=str(job.document_id))

    if job.status == "failed":
        return UploadFailedStatus(reason=job.error or "Unknown error")

    return UploadProcessingStatus(progress=int(job.progress))

