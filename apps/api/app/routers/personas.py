from __future__ import annotations

import tempfile
from base64 import b64decode
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List
from uuid import UUID, uuid4

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi import Request
from fastapi.responses import RedirectResponse, Response, StreamingResponse
from sqlalchemy.orm import Session
import json

from ..db import get_session
from ..models import Document, DocumentChunk, Persona, PersonaKnowledgeEntry, ProcessingJob
from worker.ingest import enqueue_ingestion
from ..schemas import (
    AiAssistRequest,
    AiAssistResponse,
    PersonaCreateRequest,
    PersonaDocument,
    PersonaGenerateRequest,
    PersonaKnowledgeEntry as PersonaKnowledgeEntrySchema,
    PersonaKnowledgeUpsertRequest,
    PersonaListResponse,
    PersonaPatchRequest,
    PersonaResponse,
)
from ..services.ai_assist import AiAssistService
from ..services.persona_generation import PersonaGenerationService
from ..services.persona_store import PersonaService
from ..services.target_group_store import TargetGroupService
from ..services.storage import StorageService

router = APIRouter(prefix="/personas", tags=["personas"])
generator = PersonaGenerationService()
persona_service = PersonaService()
storage = StorageService()
target_group_service = TargetGroupService()


def get_db():
    with get_session() as session:
        yield session


def _get_persona_or_404(session: Session, persona_id: str) -> Persona:
    try:
        persona_uuid = UUID(persona_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid persona id") from exc
    persona = session.get(Persona, persona_uuid)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona


@router.get(
    "",
    response_model=PersonaListResponse,
    summary="List all personas with filtering and pagination",
    description="""
    Retrieve a paginated list of personas with optional filtering capabilities.
    
    This endpoint allows you to search, filter, and paginate through all personas in the system.
    You can filter by project ID, target group ID, status, and search by name or other attributes.
    
    **Parameters:**
    - `project_id`: Filter personas by project ID (optional)
    - `target_group_id`: Filter personas by target group ID (optional)
    - `status`: Filter personas by status (optional)
    - `q` (alias `search`): Search query to filter personas by name or attributes (optional)
    - `page`: Page number for pagination (default: 1, minimum: 1)
    - `page_size`: Number of items per page (default: 20, minimum: 1, maximum: 100)
    
    **Returns:**
    - A paginated list of personas including total count, current page, and page size information.
    
    **Note:** Results are sorted by creation date (newest first) by default.
    """
)
def list_personas(
    project_id: str | None = None,
    target_group_id: str | None = Query(None),
    status: str | None = None,
    search: str | None = Query(None, alias="q"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_db),
) -> PersonaListResponse:
    try:
        return persona_service.list_personas(
            session,
            project_id=project_id,
            target_group_id=None,
            status=status,
            search=search,
            page=page,
            page_size=page_size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _persona_target_group_summary(session: Session, persona: Persona) -> str:
    if not persona.target_group_id:
        return "Keine Target Group verknüpft."
    try:
        tg = target_group_service.get_target_group(session, str(persona.target_group_id))
    except ValueError:
        return "Target Group konnte nicht geladen werden."
    summary = f"{tg.name} • Segment: {tg.segment or 'n/a'}"
    if tg.description:
        summary += f"\nBeschreibung: {tg.description}"
    return summary


def _persona_existing_pain_points(persona: Persona) -> List[str]:
    profile = persona.profile or {}
    candidates = profile.get("pain_points") or profile.get("painPoints") or []
    values: List[str] = []
    if isinstance(candidates, list):
        for entry in candidates:
            if isinstance(entry, dict):
                label = entry.get("label") or entry.get("title")
                desc = entry.get("description") or entry.get("content")
                if label and desc:
                    values.append(f"{label}: {desc}")
                elif label:
                    values.append(label)
                elif desc:
                    values.append(desc)
            elif isinstance(entry, str):
                values.append(entry)
    return values


def _build_persona_ai_context(session: Session, persona: Persona, max_items: int) -> Dict[str, Any]:
    profile_json = json.dumps(persona.profile or {}, ensure_ascii=False, indent=2)
    existing_pain_points = "\n".join(_persona_existing_pain_points(persona)) or "Keine Pain Points dokumentiert."
    return {
        "persona_name": persona.name,
        "persona_segment": persona.segment,
        "persona_profile": profile_json,
        "persona_pain_points": existing_pain_points,
        "target_group_summary": _persona_target_group_summary(session, persona),
        "max_items": max_items,
    }


@router.post(
    "/{persona_id}/ai/pain-points",
    response_model=AiAssistResponse,
    summary="Generate AI suggestions for persona pain points",
)
async def generate_persona_pain_points(
    persona_id: str,
    payload: Dict[str, int] | None = Body(default=None),
    session: Session = Depends(get_db),
) -> AiAssistResponse:
    persona = _get_persona_or_404(session, persona_id)
    max_items = (payload or {}).get("max_items", 3)
    max_items = max(1, min(max_items, 10))
    context = _build_persona_ai_context(session, persona, max_items)
    ai_request = AiAssistRequest(
        template_id="persona.pain_points",
        context=context,
        max_suggestions=max_items,
    )
    try:
        ai_assist = AiAssistService(session=session)
        return await ai_assist.generate(ai_request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "",
    response_model=PersonaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new persona manually",
    description="""
    Create a new persona profile manually by providing all required persona information.
    
    This endpoint allows you to manually create a persona without automatic generation.
    All persona fields must be provided in the request payload, including demographics,
    goals, pain points, communication style, and other profile attributes.
    
    **Parameters:**
    - `payload`: The persona creation request containing all persona details:
      - `project_id`: ID of the project this persona belongs to
      - `name`: Full name of the persona
      - `segment`: Target segment description
      - `headline`: Short headline/tagline for the persona
      - `bio`: Detailed biography
      - `profile`: Complete profile object with demographics, goals, pain points, traits, etc.
      - `confidence`: Confidence score (0.0-1.0) for the persona
      - `version`: Version string for the persona
    
    **Returns:**
    - The newly created persona object with all details including generated ID and timestamps.
    
    **Note:** Manual creation bypasses AI generation. All persona attributes must be explicitly provided.
    """
)
def create_persona(payload: PersonaCreateRequest, session: Session = Depends(get_db)) -> PersonaResponse:
    try:
        return persona_service.create_persona(session, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/generate",
    response_model=PersonaResponse,
    summary="Generate a persona automatically from research data",
    description="""
    Automatically generate a persona profile using AI based on research data and target group knowledge.
    
    This endpoint uses AI-powered persona generation to create a comprehensive persona profile
    based on available research chunks, documents, and knowledge entries associated with a target group.
    The generation process analyzes relevant research data and extracts demographics, goals,
    pain points, communication patterns, and other persona attributes.
    
    **Parameters:**
    - `payload`: The persona generation request containing:
      - `project_id`: ID of the project this persona belongs to
      - `segment`: Target segment description (required)
      - `description`: Optional additional description to guide generation
      - `filter_mode`: Filter mode for selecting research chunks ("auto" or "manual")
      - `chunk_ids`: Optional list of specific chunk IDs to use (if filter_mode is "manual")
      - `target_group_id`: Optional target group ID to retrieve knowledge from
      - `variation_params`: Optional parameters to control generation variation:
        - `randomize_chunks`: Whether to randomize chunk selection
        - `temperature`: LLM temperature (0.0-1.0) or "random"
        - `prompt_style`: Prompt style ("vivid", "analytical", "personality-focused", "goal-oriented")
        - `chunk_sample_size`: Number of chunks to sample
    
    **Returns:**
    - The generated persona object with AI-extracted attributes including demographics,
      goals, pain points, traits, communication style, and confidence score.
    
    **Note:** Generation is asynchronous and may take several seconds. The persona is created
    with a "Pending Persona" placeholder name initially and updated once generation completes.
    """
)
def generate_persona(payload: PersonaGenerateRequest, session: Session = Depends(get_db)) -> PersonaResponse:
    from uuid import uuid4
    
    # Determine target_group_id if persona_id is provided (persona might already have target_group)
    target_group_id = None
    if payload.persona_id:
        try:
            existing_persona = session.get(Persona, UUID(payload.persona_id))
            if existing_persona and existing_persona.target_group_id:
                target_group_id = existing_persona.target_group_id
        except ValueError:
            pass
    
    persona = Persona(
        project_id=UUID(payload.project_id),
        name="Pending Persona",
        segment=payload.segment,
        headline="Auto-generated persona",
        profile={},
        confidence=0.7,
        version="1.0.0",
        target_group_id=target_group_id,
    )
    session.add(persona)
    session.commit()
    session.refresh(persona)

    # In real pipeline chunk IDs would come from discovery stage
    # Now supports target_group_id for knowledge retrieval
    chunk_ids: List[UUID] = []
    generator.generate(
        persona=persona,
        chunk_ids=chunk_ids if not target_group_id else None,
        target_group_id=target_group_id,
    )

    session.refresh(persona)
    return persona_service.get_persona(session, str(persona.id), use_cache=False)


@router.get(
    "/{persona_id}",
    response_model=PersonaResponse,
    summary="Get details of a specific persona",
    description="""
    Retrieve comprehensive details of a specific persona by its ID.
    
    This endpoint returns all information about a persona including its profile,
    demographics, goals, pain points, communication style, associated documents,
    knowledge entries, and metadata.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    
    **Returns:**
    - Complete persona object with all attributes:
      - Basic information (name, headline, bio, segment)
      - Profile details (demographics, goals, pain points, traits)
      - Communication style (vocabulary, sentence structure, skepticism level)
      - Confidence score and version
      - Associated project and target group IDs
      - Creation and update timestamps
      - Image URL for avatar
    
    **Note:** Results are cached for performance. Use cache invalidation endpoints
    if persona data has been recently updated.
    """
)
def get_persona(persona_id: str, session: Session = Depends(get_db)) -> PersonaResponse:
    try:
        return persona_service.get_persona(session, persona_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Persona not found") from exc


@router.patch(
    "/{persona_id}",
    response_model=PersonaResponse,
    summary="Update an existing persona",
    description="""
    Partially update an existing persona with new or modified attributes.
    
    This endpoint allows you to update specific fields of a persona without providing
    all required fields. Only the fields provided in the request payload will be updated.
    All other fields remain unchanged.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona to update (UUID format)
    - `payload`: The partial update request containing only the fields to update:
      - `name`: Updated persona name (optional)
      - `segment`: Updated segment description (optional)
      - `headline`: Updated headline (optional)
      - `bio`: Updated biography (optional)
      - `profile`: Updated profile object (optional, can be partial)
      - `confidence`: Updated confidence score (optional)
      - `version`: Updated version string (optional)
    
    **Returns:**
    - The updated persona object with all fields (updated and unchanged).
    
    **Note:** Partial updates are supported. Fields not included in the payload remain unchanged.
    The cache for this persona is automatically invalidated after update.
    """
)
async def update_persona(
    persona_id: str,
    body: dict = Body(...),
    session: Session = Depends(get_db),
) -> PersonaResponse:
    """
    Update persona with direct JSON access to avoid Pydantic None filtering issues.
    """
    import sys
    import structlog
    from udg_glass_proto.personas import PersonaPrompt
    logger = structlog.get_logger(__name__)
    
    # CRITICAL: Log that this route was called
    logger.info("persona.update.router.entry", persona_id=persona_id)
    
    # CRITICAL: body is already a dict from FastAPI Body(...)
    # This preserves None values exactly as sent from frontend
    
    logger.info("persona.update.router.body_received", persona_id=persona_id, body_keys=list(body.keys())[:20] if body else [])
    
    # Extract profile JSON directly (no Pydantic!)
    profile_json = body.get("profile")
    
    # Build payload object manually from JSON
    # Keep Pydantic only for simple fields, not for profile
    payload = PersonaPatchRequest(
        name=body.get("name"),
        segment=body.get("segment"),
        headline=body.get("headline"),
        profile=None,  # We handle profile separately as raw JSON
        confidence=body.get("confidence"),
        version=body.get("version"),
        status=body.get("status"),
        updated_by=body.get("updated_by"),
        last_reviewed_at=body.get("last_reviewed_at"),
        image_url=body.get("image_url"),
        locked_by=body.get("locked_by"),
        locked_at=body.get("locked_at"),
        prompt=PersonaPrompt(**body["prompt"]) if body.get("prompt") else None,
    )
    
    logger.info("persona.update.router.start", persona_id=persona_id, has_profile=profile_json is not None)
    if profile_json:
        logger.info(
            "persona.update.router.profile_json",
            persona_id=persona_id,
            gender_in=('gender' in profile_json),
            gender_value=profile_json.get('gender'),
            media_affinity_in=('media_affinity' in profile_json),
            media_affinity_value=profile_json.get('media_affinity'),
            age_in=('age' in profile_json),
            age_value=profile_json.get('age'),
            profile_keys=list(profile_json.keys())[:30],
        )
    
    try:
        return persona_service.update_persona(session, persona_id, payload, profile_json=profile_json)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Persona not found") from exc


@router.delete(
    "/{persona_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a persona permanently",
    description="""
    Permanently delete a persona and all associated data from the system.
    
    This endpoint performs a complete deletion of a persona including:
    - Removing all associated documents and their chunks from storage and vector database
    - Deleting all knowledge entries
    - Removing all persona sources and prompts
    - Deleting the persona record itself
    - Invalidating all caches
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona to delete (UUID format)
    - `actor`: Optional identifier of who is performing the deletion (for audit logging)
    
    **Returns:**
    - 204 No Content on successful deletion
    
    **Note:** This is a permanent deletion operation. All associated data including
    documents, chunks, embeddings, and knowledge entries are removed. This action cannot
    be undone. An audit log entry is created before deletion for tracking purposes.
    """
)
def delete_persona(persona_id: str, actor: str | None = Query(None), session: Session = Depends(get_db)) -> None:
    try:
        persona_service.delete_persona(session, persona_id, actor=actor)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Persona not found") from exc


@router.get(
    "/{persona_id}/documents",
    response_model=List[PersonaDocument],
    summary="List all documents associated with a persona",
    description="""
    Retrieve a list of all documents that have been uploaded and associated with a specific persona.
    
    This endpoint returns all documents linked to the persona, including their processing status,
    file metadata, and ingestion information. Documents are returned in reverse chronological order
    (newest first).
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    
    **Returns:**
    - A list of document objects, each containing:
      - Document ID and filename
      - File size, content type, and upload timestamp
      - Processing status (pending, processing, completed, failed)
      - Upload metadata (uploaded_by, progress percentage)
      - Error information if processing failed
    
    **Note:** Only documents that are directly associated with the persona are returned.
    Documents may be in various states of processing (pending, processing, completed, or failed).
    """
)
def list_persona_documents(persona_id: str, session: Session = Depends(get_db)) -> List[PersonaDocument]:
    persona = _get_persona_or_404(session, persona_id)
    try:
        return persona_service.list_documents(session, persona_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/{persona_id}/documents",
    response_model=PersonaDocument,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document for a persona",
    description="""
    Upload a document file to be associated with a persona and processed for knowledge extraction.
    
    This endpoint accepts a file upload, stores it in persistent storage, and enqueues it for
    asynchronous processing. The document will be processed to extract text, create chunks,
    generate embeddings, and store them in the vector database for persona-related knowledge retrieval.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona to associate the document with (UUID format)
    - `file`: The document file to upload (multipart/form-data, supports PDF, DOCX, TXT, etc.)
    - `uploaded_by`: Optional identifier of who uploaded the document (default: "persona-admin-ui")
    
    **Returns:**
    - The created document object with processing status "processing" and a unique document ID.
    
    **Note:** Processing happens asynchronously. Use the document status endpoint or list documents
    to check processing progress. The document will be chunked, embedded, and made searchable
    once processing completes. The persona cache is automatically invalidated after upload.
    """
)
async def upload_persona_document(
    persona_id: str,
    file: UploadFile = File(...),
    uploaded_by: str = Form("persona-admin-ui"),
    session: Session = Depends(get_db),
) -> PersonaDocument:
    persona = _get_persona_or_404(session, persona_id)
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File was empty")
    content_type = file.content_type or "application/octet-stream"
    filename = file.filename or "upload.bin"
    document_id = uuid4()
    key = f"personas/{persona_id}/documents/{document_id}/{filename}"
    
    # Create document with processing status
    document = Document(
        id=document_id,
        filename=filename,
        content_type=content_type,
        size_bytes=len(contents),
        status="processing",
        object_key=key,
        file_path=key,
        persona_id=persona.id,
        uploaded_by=uploaded_by,
    )
    session.add(document)
    session.flush()
    
    # Create processing job
    job = ProcessingJob(document_id=document.id, status="pending", progress=0)
    session.add(job)
    session.commit()
    
    # Store file in filesystem (persistent storage for ingestion)
    storage.upload(key=key, data=contents, content_type=content_type)
    
    # Get the persistent file path for ingestion (same as storage path)
    from ..core.config import get_settings
    settings = get_settings()
    data_dir = Path(settings.data_dir)
    persistent_file = data_dir / key.lstrip("/")
    
    # Enqueue ingestion task with persistent file path
    import structlog
    logger = structlog.get_logger(__name__)
    logger.info("document.upload.enqueue", document_id=str(document.id), file_path=str(persistent_file), persona_id=str(persona_id))
    enqueue_ingestion(str(document.id), str(persistent_file))
    logger.info("document.upload.enqueued", document_id=str(document.id))
    
    session.refresh(document)
    persona_service.invalidate_cache(persona_id)
    return persona_service.serialize_document(document, session=session)


@router.get(
    "/{persona_id}/knowledge",
    response_model=List[PersonaKnowledgeEntrySchema],
    summary="List knowledge entries for a persona",
    description="""
    Retrieve all manual knowledge entries that have been added to a persona.
    
    This endpoint returns a list of knowledge entries that were manually created and
    associated with the persona. These entries complement the automatically extracted
    knowledge from documents and can include domain-specific insights, observations,
    or additional context about the persona.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    
    **Returns:**
    - A list of knowledge entry objects, each containing:
      - Entry ID and title
      - Content text
      - Optional metadata payload
      - Creator information and timestamps
    
    **Note:** Knowledge entries are separate from document-derived knowledge chunks.
    These are manually curated entries that provide additional context for the persona.
    """
)
def list_persona_knowledge(persona_id: str, session: Session = Depends(get_db)) -> List[PersonaKnowledgeEntrySchema]:
    persona = _get_persona_or_404(session, persona_id)
    try:
        return persona_service.list_knowledge(session, persona_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/{persona_id}/knowledge",
    response_model=PersonaKnowledgeEntrySchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add a knowledge entry to a persona",
    description="""
    Create a new manual knowledge entry and associate it with a persona.
    
    This endpoint allows you to add manually curated knowledge entries to a persona.
    These entries provide additional context, insights, or observations that complement
    the automatically extracted knowledge from documents. Knowledge entries can include
    domain-specific information, expert notes, or qualitative observations.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    - `payload`: The knowledge entry creation request containing:
      - `title`: A short title or heading for the knowledge entry
      - `content`: The main content text of the knowledge entry
      - `metadata`: Optional metadata object with additional structured information
      - `created_by`: Identifier of who created this entry (optional)
    
    **Returns:**
    - The newly created knowledge entry object with ID and timestamps.
    
    **Note:** Knowledge entries are stored separately from document chunks and provide
    a way to add manual annotations and insights to personas. The persona cache is
    automatically invalidated after adding knowledge.
    """
)
def add_persona_knowledge(
    persona_id: str,
    payload: PersonaKnowledgeUpsertRequest,
    session: Session = Depends(get_db),
) -> PersonaKnowledgeEntrySchema:
    persona = _get_persona_or_404(session, persona_id)
    entry = PersonaKnowledgeEntry(
        persona_id=persona.id,
        title=payload.title,
        content=payload.content,
        metadata_payload=payload.metadata,
        created_by=payload.created_by,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    persona_service.invalidate_cache(persona_id)
    return persona_service.serialize_knowledge_entry(entry)


@router.post(
    "/{persona_id}/avatar",
    response_model=PersonaResponse,
    summary="Upload an avatar image for a persona",
    description="""
    Upload an avatar/profile image for a persona.
    
    This endpoint accepts an image file (PNG, JPEG, etc.) and associates it with a persona
    as their avatar. The image is stored in persistent storage and the persona's image_url
    is updated to reference the stored image.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    - `file`: The image file to upload (multipart/form-data, supports PNG, JPEG, GIF, etc.)
    - `updated_by`: Optional identifier of who uploaded the avatar (default: "persona-admin-ui")
    
    **Returns:**
    - The updated persona object with the new image_url pointing to the stored avatar.
    
    **Note:** The image is stored in the personas/{persona_id}/avatars/ directory with a
    unique filename. The persona cache is automatically invalidated after upload. Previously
    uploaded avatars are not automatically deleted.
    """
)
async def upload_persona_avatar(
    persona_id: str,
    file: UploadFile = File(...),
    updated_by: str = Form("persona-admin-ui"),
    session: Session = Depends(get_db),
) -> PersonaResponse:
    persona = _get_persona_or_404(session, persona_id)
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File was empty")
    content_type = file.content_type or "image/png"
    key = f"personas/{persona_id}/avatars/{uuid4()}-{file.filename or 'avatar.png'}"
    storage.upload(key=key, data=contents, content_type=content_type)
    persona.image_url = key
    persona.updated_by = updated_by
    persona.updated_at = datetime.utcnow()
    session.add(persona)
    session.commit()
    session.refresh(persona)
    persona_service.invalidate_cache(persona_id)
    return persona_service.get_persona(session, persona_id, use_cache=False)


@router.get(
    "/{persona_id}/documents/{document_id}/download",
    summary="Download a persona document",
    description="""
    Download a document file that is associated with a persona.
    
    This endpoint retrieves the original document file from storage and streams it back
    to the client with appropriate content type and download headers.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    - `document_id`: The unique identifier of the document to download (UUID format)
    
    **Returns:**
    - Streaming response with the document file content:
      - Content-Type header set to the document's MIME type
      - Content-Disposition header with the original filename for download
      - Binary file content streamed directly from storage
    
    **Note:** The document must be associated with the specified persona. If the document
    doesn't exist or isn't linked to the persona, a 404 error is returned.
    """
)
def download_persona_document(
    persona_id: str,
    document_id: str,
    session: Session = Depends(get_db),
) -> StreamingResponse:
    persona = _get_persona_or_404(session, persona_id)
    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document id") from exc
    document = session.get(Document, document_uuid)
    if not document or document.persona_id != persona.id or not document.object_key:
        raise HTTPException(status_code=404, detail="Document not found")
    body, content_type = storage.stream(key=document.object_key)
    filename = document.filename or "document"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(body, media_type=content_type, headers=headers)


@router.post(
    "/{persona_id}/documents/{document_id}/retry",
    response_model=PersonaDocument,
    summary="Retry ingestion for a failed document",
    description="""
    Retry the ingestion process for a document that previously failed or is stuck in processing.
    
    This endpoint resets the processing job status and re-enqueues the document for ingestion.
    Useful when a document processing job failed due to transient errors or got stuck in
    a processing state.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    - `document_id`: The unique identifier of the document to retry (UUID format)
    
    **Returns:**
    - The document object with reset status ("processing") and cleared error information.
    
    **Note:** The document's processing job is reset to "pending" status and re-enqueued.
    Any previous error messages are cleared. The document must have a valid file path in storage.
    The persona cache is automatically invalidated after retry.
    """
)
def retry_persona_document_ingestion(
    persona_id: str,
    document_id: str,
    session: Session = Depends(get_db),
) -> PersonaDocument:
    """Retry ingestion for a document that failed or is stuck."""
    persona = _get_persona_or_404(session, persona_id)
    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document id") from exc
    document = session.get(Document, document_uuid)
    if not document or document.persona_id != persona.id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not document.file_path:
        raise HTTPException(status_code=400, detail="Document file path missing")
    
    # Get or create processing job
    job = session.query(ProcessingJob).filter(ProcessingJob.document_id == document_uuid).first()
    if not job:
        job = ProcessingJob(document_id=document_uuid, status="pending", progress=0)
        session.add(job)
    
    # Reset job status
    job.status = "pending"
    job.progress = 0
    job.error = None
    document.status = "processing"
    session.commit()
    
    # Get the persistent file path for ingestion
    from ..core.config import get_settings
    settings = get_settings()
    data_dir = Path(settings.data_dir)
    # document.file_path is relative to data_dir (e.g., "personas/.../file.pdf")
    # Construct full path: data_dir / file_path
    file_path_clean = document.file_path.lstrip("/")
    persistent_file = data_dir / file_path_clean
    
    # Enqueue ingestion task
    enqueue_ingestion(str(document.id), str(persistent_file))
    
    session.refresh(document)
    persona_service.invalidate_cache(persona_id)
    return persona_service.serialize_document(document, session=session)


@router.delete(
    "/{persona_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a persona document",
    description="""
    Permanently delete a document and all its associated data from the system.
    
    This endpoint performs a complete cleanup of a document including:
    - Removing the document file from storage
    - Deleting all document chunks from the vector database (Qdrant)
    - Removing all chunks from the database
    - Deleting the processing job record
    - Removing the document record itself
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    - `document_id`: The unique identifier of the document to delete (UUID format)
    
    **Returns:**
    - 204 No Content on successful deletion
    
    **Note:** This is a permanent deletion operation. All associated data including
    embeddings and chunks are removed. This action cannot be undone. The persona cache
    is automatically invalidated after deletion.
    """
)
def delete_persona_document(
    persona_id: str,
    document_id: str,
    session: Session = Depends(get_db),
) -> None:
    """Delete a document and all its associated data."""
    persona = _get_persona_or_404(session, persona_id)
    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document id") from exc
    document = session.get(Document, document_uuid)
    if not document or document.persona_id != persona.id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file from storage
    if document.object_key:
        try:
            storage.delete(key=document.object_key)
        except Exception:
            pass  # File might not exist, continue with cleanup
    
    # Delete chunks from Qdrant
    from ..core.config import get_settings
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qmodels
    settings = get_settings()
    try:
        qdrant = QdrantClient(settings.qdrant_url)
        collection = "research_chunks"
        if qdrant.collection_exists(collection):
            # Delete all points for this document
            qdrant.delete(
                collection_name=collection,
                points_selector=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="document_id",
                            match=qmodels.MatchValue(value=str(document.id)),
                        )
                    ]
                ),
            )
    except Exception:
        pass  # Qdrant might not be available, continue with cleanup
    
    # Delete chunks from database
    session.query(DocumentChunk).filter(DocumentChunk.document_id == document_uuid).delete()
    
    # Delete processing job
    session.query(ProcessingJob).filter(ProcessingJob.document_id == document_uuid).delete()
    
    # Delete document
    session.delete(document)
    session.commit()
    
    persona_service.invalidate_cache(persona_id)


@router.get(
    "/{persona_id}/avatar",
    summary="Get the avatar image for a persona",
    description="""
    Retrieve the avatar/profile image associated with a persona.
    
    This endpoint returns the avatar image for a persona. The image can be stored in
    different formats: as a URL (external), as a data URI (base64 encoded), or as a
    file in storage (internal). The endpoint handles all formats and streams the image
    with appropriate content type headers.
    
    **Parameters:**
    - `persona_id`: The unique identifier of the persona (UUID format)
    
    **Returns:**
    - Streaming response with the avatar image:
      - If image_url is an external URL: Redirect response to the external URL
      - If image_url is a data URI: Binary image data extracted from the data URI
      - If image_url is a storage key: Streaming response with image from storage
      - Appropriate Content-Type header based on image format
    
    **Note:** If no avatar has been set for the persona, a 404 error is returned.
    The endpoint automatically handles different image storage formats.
    """
)
def get_persona_avatar(persona_id: str, session: Session = Depends(get_db)):
    persona = _get_persona_or_404(session, persona_id)
    if not persona.image_url:
        raise HTTPException(status_code=404, detail="Avatar not found")
    if persona.image_url.startswith(("http://", "https://")):
        return RedirectResponse(persona.image_url)
    if persona.image_url.startswith("data:"):
        try:
            header, encoded = persona.image_url.split(",", 1)
            media_type = header.split(";")[0].split(":", 1)[1] if ";" in header else "image/png"
            data = b64decode(encoded)
        except (ValueError, IndexError, TypeError) as exc:
            raise HTTPException(status_code=400, detail="Invalid avatar data URI") from exc
        return Response(content=data, media_type=media_type)
    try:
        body, content_type = storage.stream(key=persona.image_url)
    except Exception as exc:  # pragma: no cover - external dependency
        raise HTTPException(status_code=404, detail="Avatar not found") from exc
    return StreamingResponse(body, media_type=content_type)

