from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from msqdx_glass_proto import UploadJobStatus

from ..db import get_session
from ..models import Document, Persona, ProcessingJob, TargetGroup, User
from ..schemas import DocumentUploadResponse
from ..services.auth import get_current_user
from ..services.access_control import list_accessible_project_ids
from ..services.storage import StorageService
from worker.ingest import enqueue_ingestion

router = APIRouter(prefix="/documents", tags=["documents"])
storage = StorageService()


def get_db(current_user: User = Depends(get_current_user)):
    with get_session() as session:
        session.info["current_user_id"] = current_user.id
        session.info["allowed_project_ids"] = list_accessible_project_ids(session, current_user.id)
        yield session


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    summary="Upload a document for processing",
    description="""
    Upload a document file for asynchronous processing and ingestion.
    
    This endpoint accepts a file upload, stores it in persistent storage, and enqueues it for processing.
    The document will be processed asynchronously through the ingestion pipeline which includes:
    - Text extraction and parsing
    - Chunking and embedding generation
    - Storage in Qdrant vector database
    - Graph database integration
    
    **Parameters:**
    - `file`: The document file to upload (supports various formats including PDF, DOCX, TXT, etc.)
    
    **Returns:**
    - `job_id`: A unique identifier for the processing job. Use this to check the job status via the status endpoint.
    
    **Note:** Processing happens asynchronously. Use the returned `job_id` to poll the status endpoint for progress updates.
    """
)
async def upload_document(
    file: UploadFile = File(...),
    session: Session = Depends(get_db),
) -> DocumentUploadResponse:
    filename = file.filename or f"upload-{uuid4().hex}.bin"
    document_id = uuid4()
    key = f"documents/{document_id}/{filename}"
    document = Document(
        id=document_id,
        filename=filename,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=file.size or 0,
        status="processing",
        file_path=key,
        object_key=key,
        uploaded_by=str(session.info.get("current_user_id")) if session.info else None,
    )
    session.add(document)
    session.flush()

    job = ProcessingJob(document_id=document.id, status="pending", progress=0)
    session.add(job)
    session.commit()

    contents = await file.read()

    # Store file in filesystem (persistent storage for ingestion)
    storage.upload(key=key, data=contents, content_type=document.content_type)
    
    # Get the persistent file path for ingestion (same as storage path)
    from ..core.config import get_settings
    settings = get_settings()
    data_dir = Path(settings.data_dir)
    persistent_file = data_dir / key.lstrip("/")

    enqueue_ingestion(str(document.id), str(persistent_file))

    return DocumentUploadResponse(job_id=str(job.id))


@router.get(
    "/{job_id}/status",
    summary="Get the status of a document processing job",
    description="""
    Retrieve the current status of a document processing job.
    
    This endpoint allows you to check the progress of a document that was uploaded for processing.
    The status can be one of:
    - `pending`: The job is queued and waiting to be processed
    - `processing`: The document is currently being processed (includes progress percentage)
    - `completed`: The processing finished successfully (includes the document ID)
    - `failed`: The processing encountered an error (includes error reason)
    
    **Parameters:**
    - `job_id`: The unique identifier of the processing job (returned from the upload endpoint)
    
    **Returns:**
    - Status information including:
      - Current status (`pending`, `processing`, `completed`, or `failed`)
      - Progress percentage (0-100) when status is `processing`
      - Document ID when status is `completed`
      - Error reason when status is `failed`
    
    **Usage:** Poll this endpoint periodically to track processing progress until the status is either `completed` or `failed`.
    """
)
def job_status(
    job_id: str,
    project_id: str | None = Query(None),
    session: Session = Depends(get_db),
) -> UploadJobStatus:
    job = session.get(ProcessingJob, job_id)
    if not job:
        return UploadJobStatus(status="failed", reason="Job not found")  # type: ignore[return-value]
    allowed_project_ids = session.info.get("allowed_project_ids") if session.info else []
    document = session.get(Document, job.document_id)
    persona_project_id = None
    target_group_project_id = None
    if document and document.persona_id:
        persona = session.get(Persona, document.persona_id)
        persona_project_id = persona.project_id if persona else None
    if document and document.target_group_id:
        target_group = session.get(TargetGroup, document.target_group_id)
        target_group_project_id = target_group.project_id if target_group else None
    if allowed_project_ids:
        if {persona_project_id, target_group_project_id}.isdisjoint(set(allowed_project_ids)):
            return UploadJobStatus(status="failed", reason="Job not found")  # type: ignore[return-value]
    if project_id:
        try:
            project_uuid = UUID(project_id)
        except ValueError:
            return UploadJobStatus(status="failed", reason="Invalid project id")  # type: ignore[return-value]
        if project_uuid not in allowed_project_ids:
            return UploadJobStatus(status="failed", reason="Job not found")  # type: ignore[return-value]
        if project_uuid not in {persona_project_id, target_group_project_id}:
            return UploadJobStatus(status="failed", reason="Job not found")  # type: ignore[return-value]
    if job.status == "completed":
        return UploadJobStatus(status="completed", document_id=str(job.document_id))  # type: ignore[return-value]
    if job.status == "failed":
        return UploadJobStatus(status="failed", reason=job.error or "Unknown error")  # type: ignore[return-value]
    return UploadJobStatus(status="processing", progress=int(job.progress))  # type: ignore[return-value]
