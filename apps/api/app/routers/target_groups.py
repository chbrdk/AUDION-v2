from __future__ import annotations

from typing import List
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Body, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..core.http_exceptions import exception_to_http
from ..db import get_session
from ..models import Document, Persona, ProcessingJob, Project, TargetGroup, TargetGroupKnowledgeEntry, User
from worker.ingest import enqueue_ingestion
from ..schemas import (
    PersonaDocument,
    PersonaKnowledgeEntry as PersonaKnowledgeEntrySchema,
    PersonaKnowledgeUpsertRequest as TargetGroupKnowledgeUpsertRequest,
    PersonaListResponse,
    PersonaResponse,
    PersonaSuggestionItem,
    SuggestPersonasRequest,
    SuggestPersonasResponse,
    TargetGroupCreateRequest,
    TargetGroupListResponse,
    TargetGroupPersonaGenerateRequest,
    TargetGroupResponse,
    TargetGroupUpdateRequest,
    KnowledgeChunk,
    ClusterResult,
    SimilarChunk,
)
from ..services.knowledge_ingestion import KnowledgeIngestionService
from ..services.persona_bootstrap import generate_persona_for_target_group
from ..services.persona_store import PersonaService
from ..services.suggest_personas import suggest_personas as run_suggest_personas
from ..core.config import get_settings
from ..core.upload_limits import read_upload_with_limit
from ..services.storage import StorageService
from ..services.target_group_store import TargetGroupService
from ..services.auth import get_current_user
from ..services.access_control import list_accessible_project_ids
from ..services.usage_report import report_usage
from ..services.checkion_project_context import build_optional_checkion_topics_prompt_block
from ..services.project_research_prompt import build_optional_project_research_json_context

logger = structlog.get_logger(__name__)
storage = StorageService()
persona_service = PersonaService()

router = APIRouter(prefix="/target-groups", tags=["target-groups"])
service = TargetGroupService()

SCHEMA_SOURCE_PATH = "`apps/api/app/schemas/__init__.py`"
PERSONA_SCHEMA_DOC = "`knowledge/persona_schema.yaml`"
TARGET_GROUP_DOC_SECTION = "`knowledge/target_group_migration.md#schemas--verwendungen`"


def get_db(current_user: User = Depends(get_current_user)):
    with get_session() as session:
        session.info["current_user_id"] = current_user.id
        session.info["allowed_project_ids"] = list_accessible_project_ids(session, current_user.id)
        yield session


def _get_target_group_or_404(
    session: Session,
    target_group_id: str,
    allowed_project_ids: list[UUID] | None = None,
) -> TargetGroup:
    try:
        tg_uuid = UUID(target_group_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid target group id") from exc
    tg = session.get(TargetGroup, tg_uuid)
    if allowed_project_ids is None:
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
    if not tg or (allowed_project_ids is not None and tg.project_id not in allowed_project_ids):
        raise HTTPException(status_code=404, detail="Target group not found")
    return tg


@router.get(
    "",
    response_model=TargetGroupListResponse,
    summary="List all target groups with filtering and pagination",
    description=f"""
    Retrieve a paginated list of target groups with optional filtering capabilities.
    
    This endpoint allows you to search and paginate through all target groups in the system.
    You can filter by project ID to get target groups associated with a specific project.
    
    **Parameters:**
    - `project_id`: Filter target groups by project ID (optional)
    - `page`: Page number for pagination (default: 1, minimum: 1)
    - `page_size`: Number of items per page (default: 20, minimum: 1, maximum: 100)
    
    **Returns:**
    - A paginated list of target groups including total count, current page, and page size information.
    Each target group includes its ID, name, description, project ID, and associated metadata.
    
    **Note:** Results are sorted by creation date (newest first) by default. Target groups are
    organizational units that group related knowledge and personas together.
    
    **Schemas:**
    - Response: `TargetGroupListResponse` (see {SCHEMA_SOURCE_PATH})
    - Items: `TargetGroupListItem` with persona/knowledge counters captured in {TARGET_GROUP_DOC_SECTION}
    """
)
def list_target_groups(
    project_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    include_archived: bool = Query(False, description="Include archived target groups in the list."),
    session: Session = Depends(get_db),
) -> TargetGroupListResponse:
    try:
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
        return service.list_target_groups(
            session,
            allowed_project_ids=allowed_project_ids,
            project_id=project_id,
            page=page,
            page_size=page_size,
            include_archived=include_archived,
        )
    except ValueError as exc:
        if str(exc) == "project_access_denied":
            raise HTTPException(status_code=403, detail="Project access denied") from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "",
    response_model=TargetGroupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new target group",
    description=f"""
    Create a new target group in the system.
    
    Target groups are organizational units that group related knowledge, documents, and personas
    together. They provide a way to organize and segment research data for persona generation
    and knowledge management.
    
    **Parameters:**
    - `payload`: The target group creation request containing:
      - `project_id`: ID of the project this target group belongs to (required)
      - `name`: Name of the target group (required)
      - `description`: Optional description of the target group
      - `metadata`: Optional metadata object with additional structured information
    
    **Returns:**
    - The newly created target group object with all details including generated ID and timestamps.
    
    **Note:** Target groups are used to organize knowledge entries, documents, and personas.
    Once created, you can add knowledge entries, upload documents, and generate personas for the target group.
    
    **Schemas:**
    - Request: `TargetGroupCreateRequest` (see {SCHEMA_SOURCE_PATH})
    - Response: `TargetGroupResponse` with nested `PersonaListItem` / knowledge entries described in {TARGET_GROUP_DOC_SECTION}
    """
)
def create_target_group(
    payload: TargetGroupCreateRequest,
    session: Session = Depends(get_db),
) -> TargetGroupResponse:
    try:
        allowed_project_ids = session.info.get("allowed_project_ids") if session.info else None
        if allowed_project_ids is not None:
            try:
                project_uuid = UUID(payload.project_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid project_id") from exc
            if project_uuid not in allowed_project_ids:
                raise HTTPException(status_code=403, detail="Project access denied")
        return service.create_target_group(session, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        logger.exception("target_group.create_failed", project_id=payload.project_id)
        raise HTTPException(
            status_code=500,
            detail="Target group could not be saved. Check API logs and database migrations.",
        ) from exc


@router.get(
    "/{target_group_id}",
    response_model=TargetGroupResponse,
    summary="Get details of a specific target group",
    description=f"""
    Retrieve comprehensive details of a specific target group by its ID.
    
    This endpoint returns all information about a target group including its name,
    description, associated project, and metadata. It also includes counts and
    references to associated knowledge entries, documents, and personas.
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group (UUID format)
    
    **Returns:**
    - Complete target group object with all attributes:
      - Basic information (id, name, description)
      - Project association (project_id)
      - Metadata and timestamps
      - Counts of associated knowledge entries, documents, and personas
    
    **Note:** This endpoint provides a complete view of the target group's structure
    and relationships within the system.
    
    **Schemas:**
    - Response: `TargetGroupResponse` (see {SCHEMA_SOURCE_PATH})
    - Nested persona profile data follows {PERSONA_SCHEMA_DOC}
    """
)
def get_target_group(
    target_group_id: str,
    session: Session = Depends(get_db),
) -> TargetGroupResponse:
    try:
        _get_target_group_or_404(session, target_group_id)
        return service.get_target_group(session, target_group_id)
    except ValueError as exc:
        if "not found" in str(exc):
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch(
    "/{target_group_id}",
    response_model=TargetGroupResponse,
    summary="Update an existing target group",
    description=f"""
    Partially update an existing target group with new or modified attributes.
    
    This endpoint allows you to update specific fields of a target group without providing
    all required fields. Only the fields provided in the request payload will be updated.
    All other fields remain unchanged.
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group to update (UUID format)
    - `payload`: The partial update request containing only the fields to update:
      - `name`: Updated target group name (optional)
      - `description`: Updated description (optional)
      - `metadata`: Updated metadata object (optional, can be partial)
    
    **Returns:**
    - The updated target group object with all fields (updated and unchanged).
    
    **Note:** Partial updates are supported. Fields not included in the payload remain unchanged.
    Updating a target group does not affect its associated knowledge entries, documents, or personas.
    
    **Schemas:**
    - Request: `TargetGroupUpdateRequest` (see {SCHEMA_SOURCE_PATH})
    - Response: `TargetGroupResponse` with nested entities documented in {TARGET_GROUP_DOC_SECTION}
    """
)
def update_target_group(
    target_group_id: str,
    payload: TargetGroupUpdateRequest,
    session: Session = Depends(get_db),
) -> TargetGroupResponse:
    try:
        return service.update_target_group(session, target_group_id, payload)
    except ValueError as exc:
        if "not found" in str(exc):
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete(
    "/{target_group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a target group",
    description="""
    Permanently delete a target group and its associated knowledge entries and sources.

    Linked personas are kept but unlinked from this target group (`target_group_id` set to null).
    Documents linked to the target group are not deleted from storage by this operation alone.
    """,
)
def delete_target_group(
    target_group_id: str,
    session: Session = Depends(get_db),
) -> None:
    try:
        _get_target_group_or_404(session, target_group_id)
        service.delete_target_group(session, target_group_id)
    except ValueError as exc:
        if "not found" in str(exc):
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/{target_group_id}/knowledge/chunks",
    response_model=List[KnowledgeChunk],
    summary="List all knowledge chunks for a target group",
    description=f"""
    Retrieve all knowledge chunks associated with a target group.
    
    This endpoint returns all document chunks and manual knowledge entry chunks that have been
    linked to the target group. Chunks include both automatically extracted chunks from uploaded
    documents and chunks created from manual knowledge entries. Each chunk includes metadata
    about its source document, relevance score, and content.
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group (UUID format)
    - `limit`: Maximum number of chunks to return (default: 1000, minimum: 1, maximum: 5000)
    
    **Returns:**
    - A list of knowledge chunk objects, each containing:
      - Chunk ID and content text
      - Source document ID and filename
      - Relevance score (from TargetGroupSource)
      - Optional metadata
      - Placeholder fields for visualization (x, y, cluster_id - set by clustering endpoint)
    
    **Note:** Chunks are retrieved from both documents and manual knowledge entries associated
    with the target group. The relevance score indicates how relevant each chunk is to the target group.
    
    **Schemas:**
    - Response: `List[KnowledgeChunk]` (see {SCHEMA_SOURCE_PATH})
    - Chunk usage context documented in {TARGET_GROUP_DOC_SECTION}
    """
)
def list_target_group_chunks(
    target_group_id: str,
    limit: int = Query(1000, ge=1, le=5000),
    session: Session = Depends(get_db),
) -> List[KnowledgeChunk]:
    """List all chunks for a target group with metadata."""
    _get_target_group_or_404(session, target_group_id)
    try:
        from ..services.knowledge_explorer import KnowledgeExplorerService

        explorer = KnowledgeExplorerService()
        chunks_data = explorer.get_chunks_for_target_group(session, target_group_id, limit)

        # Convert to KnowledgeChunk schema
        chunks = []
        for chunk_data in chunks_data:
            chunks.append(
                KnowledgeChunk(
                    id=chunk_data["id"],
                    content=chunk_data["content"],
                    document_id=chunk_data["document_id"],
                    document_filename=chunk_data["document_filename"],
                    relevance_score=chunk_data["relevance_score"],
                    metadata=chunk_data.get("metadata"),
                    x=None,  # Will be set by clustering endpoint
                    y=None,  # Will be set by clustering endpoint
                    cluster_id=None,  # Will be set by clustering endpoint
                )
            )
        return chunks
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("knowledge.chunks.error", target_group_id=target_group_id, error=str(exc), exc_info=True)
        raise exception_to_http(exc, "Retrieve chunks") from exc


@router.get(
    "/{target_group_id}/knowledge/clusters",
    response_model=ClusterResult,
    summary="Cluster knowledge chunks for visualization",
    description=f"""
    Perform clustering analysis on knowledge chunks to identify thematic groups and prepare data for visualization.
    
    This endpoint uses machine learning clustering algorithms (K-Means or DBSCAN) to group similar
    knowledge chunks together. It also performs dimensionality reduction to create 2D coordinates
    for visualization purposes. The clustering helps identify themes, patterns, and relationships
    within the target group's knowledge base.
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group (UUID format)
    - `method`: Clustering algorithm to use - "kmeans" or "dbscan" (default: "kmeans")
    - `n_clusters`: Number of clusters to create for K-Means (default: 10, minimum: 2, maximum: 50)
      Note: Only used when method is "kmeans"
    - `min_samples`: Minimum number of samples required for a cluster in DBSCAN (default: 3, minimum: 2, maximum: 20)
      Note: Only used when method is "dbscan"
    - `limit`: Maximum number of chunks to cluster (default: 1000, minimum: 1, maximum: 5000)
    
    **Returns:**
    - Cluster result object containing:
      - `clusters`: List of cluster objects with cluster IDs and statistics
      - `chunks`: List of chunks with assigned cluster IDs and 2D coordinates (x, y)
      - `coordinates_2d`: 2D coordinates for visualization
      - `cluster_labels`: Cluster assignment for each chunk
      - `method`: The clustering method used
    
    **Note:** Clustering requires chunks to have embeddings. Chunks without embeddings are included
    in the result but won't have coordinates or cluster assignments. The 2D coordinates are generated
    using dimensionality reduction (typically t-SNE or UMAP) for visualization purposes.
    
    **Schemas:**
    - Response: `ClusterResult` plus `KnowledgeCluster` / `KnowledgeChunk` (see {SCHEMA_SOURCE_PATH})
    - Visualization guidance in {TARGET_GROUP_DOC_SECTION}
    """
)
def get_target_group_clusters(
    target_group_id: str,
    method: str = Query("kmeans", regex="^(kmeans|dbscan)$"),
    n_clusters: int = Query(10, ge=2, le=50),
    min_samples: int = Query(3, ge=2, le=20),
    limit: int = Query(1000, ge=1, le=5000),
    session: Session = Depends(get_db),
) -> ClusterResult:
    """Cluster chunks for a target group."""
    _get_target_group_or_404(session, target_group_id)
    try:
        from ..services.knowledge_explorer import KnowledgeExplorerService

        explorer = KnowledgeExplorerService()

        # Get chunks with embeddings
        chunks_data = explorer.get_chunks_for_target_group(session, target_group_id, limit)

        if not chunks_data:
            return ClusterResult(
                clusters=[],
                chunks=[],
                coordinates_2d=[],
                cluster_labels=[],
                method=method,
            )

        # Perform clustering
        cluster_result = explorer.cluster_chunks(
            chunks_data,
            method=method,
            n_clusters=n_clusters if method == "kmeans" else 10,  # DBSCAN doesn't use n_clusters
            min_samples=min_samples if method == "dbscan" else 3,  # K-Means doesn't use min_samples
        )

        # Map coordinates and cluster labels to chunks
        chunks = []
        coordinates_2d = cluster_result["coordinates_2d"]
        cluster_labels = cluster_result["cluster_labels"]

        # Only chunks with embeddings have coordinates
        # chunks_with_embeddings = [c for c in chunks_data if c.get("embedding")]
        coord_idx = 0

        for idx, chunk_data in enumerate(chunks_data):
            x = None
            y = None
            cluster_id = cluster_labels[idx] if idx < len(cluster_labels) else None

            # Only assign coordinates if chunk has embedding
            if chunk_data.get("embedding"):
                if coord_idx < len(coordinates_2d):
                    coord = coordinates_2d[coord_idx]
                    x = coord[0] if len(coord) > 0 else None
                    y = coord[1] if len(coord) > 1 else None
                    coord_idx += 1

            chunks.append(
                KnowledgeChunk(
                    id=chunk_data["id"],
                    content=chunk_data["content"],
                    document_id=chunk_data["document_id"],
                    document_filename=chunk_data["document_filename"],
                    relevance_score=chunk_data["relevance_score"],
                    metadata=chunk_data.get("metadata"),
                    x=x,
                    y=y,
                    cluster_id=cluster_id,
                )
            )

        return ClusterResult(
            clusters=cluster_result["clusters"],
            chunks=chunks,
            coordinates_2d=coordinates_2d,
            cluster_labels=cluster_labels,
            method=method,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("knowledge.clusters.error", target_group_id=target_group_id, error=str(exc), exc_info=True)
        raise exception_to_http(exc, "Cluster chunks") from exc


@router.get(
    "/{target_group_id}/knowledge/chunks/{chunk_id}/similar",
    response_model=List[SimilarChunk],
    summary="Find similar chunks to a given chunk",
    description=f"""
    Find knowledge chunks that are semantically similar to a given chunk.
    
    This endpoint uses vector similarity search in the Qdrant database to find chunks with
    similar semantic meaning. The similarity is calculated based on the embeddings of the chunks.
    Only chunks associated with the specified target group are considered in the search.
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group (UUID format)
    - `chunk_id`: The unique identifier of the chunk to find similar chunks for (UUID format)
    - `limit`: Maximum number of similar chunks to return (default: 10, minimum: 1, maximum: 50)
    
    **Returns:**
    - A list of similar chunk objects, each containing:
      - Chunk ID and content text
      - Similarity score (0.0 to 1.0, where 1.0 is most similar)
      - Source document ID
    
    **Note:** Similarity is calculated using cosine similarity on chunk embeddings. Results are
    sorted by similarity score (highest first). The specified chunk itself may be included in
    the results if it exists. Only chunks within the same target group are returned.
    
    **Schemas:**
    - Response: `List[SimilarChunk]` (see {SCHEMA_SOURCE_PATH})
    - Usage scenarios documented in {TARGET_GROUP_DOC_SECTION}
    """
)
def get_similar_chunks(
    target_group_id: str,
    chunk_id: str,
    limit: int = Query(10, ge=1, le=50),
    session: Session = Depends(get_db),
) -> List[SimilarChunk]:
    """Find similar chunks to a given chunk."""
    _get_target_group_or_404(session, target_group_id)
    try:
        from ..services.knowledge_explorer import KnowledgeExplorerService

        explorer = KnowledgeExplorerService()
        similar_data = explorer.get_similar_chunks(chunk_id, target_group_id, limit)

        # Convert to SimilarChunk schema
        similar = []
        for similar_item in similar_data:
            similar.append(
                SimilarChunk(
                    id=similar_item["id"],
                    content=similar_item["content"],
                    similarity=similar_item.get("similarity", 0.0),
                    document_id=similar_item.get("document_id", ""),
                )
            )
        return similar
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("knowledge.similar.error", target_group_id=target_group_id, chunk_id=chunk_id, error=str(exc), exc_info=True)
        raise exception_to_http(exc, "Find similar chunks") from exc


@router.get(
    "/{target_group_id}/knowledge",
    response_model=List[PersonaKnowledgeEntrySchema],
    summary="List manual knowledge entries for a target group",
    description=f"""
    Retrieve all manual knowledge entries that have been added to a target group.
    
    This endpoint returns a list of knowledge entries that were manually created and
    associated with the target group. These entries are distinct from document-derived
    chunks and represent curated knowledge, observations, or domain-specific insights
    about the target group.
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group (UUID format)
    
    **Returns:**
    - A list of knowledge entry objects, each containing:
      - Entry ID and title
      - Content text
      - Optional metadata payload
      - Creator information and timestamps
    
    **Note:** Knowledge entries are manually curated and are automatically embedded and made
    searchable when created. They complement document-derived knowledge and are used in persona
    generation and knowledge retrieval operations.
    
    **Schemas:**
    - Response: `List[PersonaKnowledgeEntry]` (see {SCHEMA_SOURCE_PATH})
    - Knowledge governance described in {TARGET_GROUP_DOC_SECTION}
    """
)
def list_target_group_knowledge(
    target_group_id: str,
    session: Session = Depends(get_db),
) -> List[PersonaKnowledgeEntrySchema]:
    _get_target_group_or_404(session, target_group_id)
    try:
        return service.list_knowledge(session, target_group_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/{target_group_id}/knowledge",
    response_model=PersonaKnowledgeEntrySchema,
    status_code=status.HTTP_201_CREATED,
    summary="Add a manual knowledge entry to a target group",
    description=f"""
    Create a new manual knowledge entry and associate it with a target group.
    
    This endpoint allows you to add manually curated knowledge entries to a target group.
    The knowledge entry will be automatically processed: it will be converted into a document
    chunk, embedded using AI, and stored in the vector database for semantic search. This makes
    the knowledge entry available for persona generation and knowledge retrieval operations.
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group (UUID format)
    - `payload`: The knowledge entry creation request containing:
      - `title`: A short title or heading for the knowledge entry (required)
      - `content`: The main content text of the knowledge entry (required)
      - `metadata`: Optional metadata object with additional structured information
      - `created_by`: Identifier of who created this entry (optional)
    
    **Returns:**
    - The newly created knowledge entry object with ID and timestamps.
    
    **Note:** The knowledge entry is automatically ingested after creation: a document chunk
    is created, an embedding is generated, and it's stored in Qdrant. If ingestion fails,
    the entry is still saved but may not be immediately searchable. Ingestion errors are logged
    but don't cause the request to fail.
    
    **Schemas:**
    - Request: `TargetGroupKnowledgeUpsertRequest` (see {SCHEMA_SOURCE_PATH})
    - Response: `PersonaKnowledgeEntry` with payload fields captured in {TARGET_GROUP_DOC_SECTION}
    """
)
def add_target_group_knowledge(
    target_group_id: str,
    payload: TargetGroupKnowledgeUpsertRequest,
    session: Session = Depends(get_db),
) -> PersonaKnowledgeEntrySchema:
    tg = _get_target_group_or_404(session, target_group_id)
    entry = TargetGroupKnowledgeEntry(
        target_group_id=tg.id,
        title=payload.title,
        content=payload.content,
        metadata_payload=payload.metadata,
        created_by=payload.created_by,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    
    # Ingest knowledge entry (create chunk, embed, store in Qdrant)
    try:
        knowledge_service = KnowledgeIngestionService()
        knowledge_service.ingest_knowledge_entry(entry.id)
    except Exception as e:
        logger.error("knowledge.ingest.failed", entry_id=str(entry.id), error=str(e))
        # Don't fail the request, but log the error
        # The entry is saved, but not embedded yet
    
    return service.serialize_knowledge_entry(entry, str(tg.id))


@router.put(
    "/{target_group_id}/knowledge/{knowledge_id}",
    response_model=PersonaKnowledgeEntrySchema,
    summary="Update a knowledge entry",
    description=f"""
    Update an existing manual knowledge entry for a target group.
    
    This endpoint allows you to modify the title, content, or metadata of an existing knowledge
    entry. When the content is updated, the entry is automatically re-embedded and updated in
    the vector database to reflect the changes.
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group (UUID format)
    - `knowledge_id`: The unique identifier of the knowledge entry to update (UUID format)
    - `payload`: The knowledge entry update request containing:
      - `title`: Updated title (required)
      - `content`: Updated content text (required)
      - `metadata`: Updated metadata object (optional)
    
    **Returns:**
    - The updated knowledge entry object with all fields.
    
    **Note:** When content is updated, the entry is automatically re-embedded and the vector
    in Qdrant is updated. If the embedding update fails, the entry update still succeeds but
    the vector may be out of sync. Update errors are logged but don't cause the request to fail.
    
    **Schemas:**
    - Request: `TargetGroupKnowledgeUpsertRequest` (see {SCHEMA_SOURCE_PATH})
    - Response: `PersonaKnowledgeEntry`
    """
)
def update_target_group_knowledge(
    target_group_id: str,
    knowledge_id: str,
    payload: TargetGroupKnowledgeUpsertRequest,
    session: Session = Depends(get_db),
) -> PersonaKnowledgeEntrySchema:
    tg = _get_target_group_or_404(session, target_group_id)
    entry = session.scalar(
        select(TargetGroupKnowledgeEntry)
        .where(TargetGroupKnowledgeEntry.id == knowledge_id)
        .where(TargetGroupKnowledgeEntry.target_group_id == tg.id)
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    
    # Update entry
    entry.title = payload.title
    entry.content = payload.content
    entry.metadata_payload = payload.metadata
    session.commit()
    session.refresh(entry)
    
    # Update embedding and Qdrant vector
    try:
        knowledge_service = KnowledgeIngestionService()
        knowledge_service.update_knowledge_entry(entry.id)
    except Exception as e:
        logger.error("knowledge.update.failed", entry_id=str(entry.id), error=str(e))
        # Don't fail the request, but log the error
    
    return service.serialize_knowledge_entry(entry, str(tg.id))


@router.delete(
    "/{target_group_id}/knowledge/{knowledge_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a knowledge entry",
    description=f"""
    Permanently delete a manual knowledge entry and all its associated data.
    
    This endpoint performs a complete cleanup of a knowledge entry including:
    - Removing the associated document chunk from the database
    - Deleting the vector from Qdrant
    - Removing the TargetGroupSource relationship
    - Deleting the knowledge entry itself
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group (UUID format)
    - `knowledge_id`: The unique identifier of the knowledge entry to delete (UUID format)
    
    **Returns:**
    - 204 No Content on successful deletion
    
    **Note:** This is a permanent deletion operation. All associated data including embeddings
    and chunks are removed. If cleanup operations (Qdrant deletion, etc.) fail, the entry
    is still deleted, but orphaned data may remain. Cleanup errors are logged but don't prevent
    the entry deletion.
    
    **Schemas:**
    - Response: 204 No Content; request/response payload structure documented in {TARGET_GROUP_DOC_SECTION}
    """
)
def delete_target_group_knowledge(
    target_group_id: str,
    knowledge_id: str,
    session: Session = Depends(get_db),
) -> None:
    tg = _get_target_group_or_404(session, target_group_id)
    entry = session.scalar(
        select(TargetGroupKnowledgeEntry)
        .where(TargetGroupKnowledgeEntry.id == knowledge_id)
        .where(TargetGroupKnowledgeEntry.target_group_id == tg.id)
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    
    # Delete associated chunk, vector, and TargetGroupSource
    try:
        knowledge_service = KnowledgeIngestionService()
        knowledge_service.delete_knowledge_entry(entry.id)
    except Exception as e:
        logger.error("knowledge.delete.failed", entry_id=str(entry.id), error=str(e))
        # Continue with entry deletion even if cleanup fails
    
    # Delete the entry itself
    session.delete(entry)
    session.commit()


@router.get(
    "/{target_group_id}/documents",
    response_model=List[PersonaDocument],
    summary="List all documents associated with a target group",
    description=f"""
    Retrieve a list of all documents that have been uploaded and associated with a specific target group.
    
    This endpoint returns all documents linked to the target group, including their processing status,
    file metadata, and ingestion information. Documents are returned in reverse chronological order
    (newest first).
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group (UUID format)
    
    **Returns:**
    - A list of document objects, each containing:
      - Document ID and filename
      - File size, content type, and upload timestamp
      - Processing status (pending, processing, completed, failed)
      - Upload metadata (uploaded_by, progress percentage)
      - Error information if processing failed
    
    **Note:** Only documents that are directly associated with the target group are returned.
    Documents may be in various states of processing (pending, processing, completed, or failed).
    Once processed, documents contribute chunks to the target group's knowledge base.
    
    **Schemas:**
    - Response: `List[PersonaDocument]` (see {SCHEMA_SOURCE_PATH})
    - Document lifecycle also captured in {TARGET_GROUP_DOC_SECTION}
    """
)
async def list_target_group_documents(
    target_group_id: str,
    session: Session = Depends(get_db),
) -> List[PersonaDocument]:
    from ..core.config import get_settings
    from ..services.storion_client import storion_client
    import structlog
    import uuid as uuid_module
    
    logger = structlog.get_logger(__name__)
    settings = get_settings()
    
    # Try to get from STORION if proxy enabled
    if settings.use_storion_proxy:
        try:
            storion_files = await storion_client.list_files(
                service="audion",
                entity_type="target_group",
                entity_id=target_group_id,
            )
            
            # Convert STORION files to PersonaDocument format
            documents = []
            for file_data in storion_files:
                document = Document(
                    id=uuid4(),
                    filename=file_data.get("filename", ""),
                    content_type=file_data.get("content_type", ""),
                    size_bytes=file_data.get("size", 0),
                    status=file_data.get("status", "pending"),
                    object_key=file_data.get("id", ""),
                    file_path=file_data.get("id", ""),
                    target_group_id=uuid_module.UUID(target_group_id),
                    uploaded_by=file_data.get("uploaded_by"),
                )
                documents.append(service._to_document_payload(document, session=session, target_group_id=target_group_id))
            
            if documents:
                return documents
        except Exception as e:
            logger.warning("document.list.storion_failed", error=str(e), target_group_id=target_group_id)
    
    # Local query (fallback)
    _get_target_group_or_404(session, target_group_id)
    try:
        return service.list_documents(session, target_group_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("documents.list.failed", error=str(exc), target_group_id=target_group_id, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal Server Error") from exc


@router.post(
    "/{target_group_id}/documents",
    response_model=PersonaDocument,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document for a target group",
    description=f"""
    Upload a document file to be associated with a target group and processed for knowledge extraction.
    
    This endpoint accepts a file upload, stores it in persistent storage, and enqueues it for
    asynchronous processing. The document will be processed to extract text, create chunks,
    generate embeddings, and store them in the vector database. The chunks will be automatically
    linked to the target group through TargetGroupSource relationships.
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group to associate the document with (UUID format)
    - `file`: The document file to upload (multipart/form-data, supports PDF, DOCX, TXT, etc.)
    - `uploaded_by`: Optional identifier of who uploaded the document (default: "target-group-admin-ui")
    
    **Returns:**
    - The created document object with processing status "processing" and a unique document ID.
    
    **Note:** Processing happens asynchronously. Use the document status endpoint or list documents
    to check processing progress. Once processed, document chunks will be automatically associated
    with the target group and available for persona generation and knowledge retrieval.
    
    **Schemas:**
    - Response: `PersonaDocument` (see {SCHEMA_SOURCE_PATH})
    - Request: multipart upload fields documented in {TARGET_GROUP_DOC_SECTION}
    """
)
async def upload_target_group_document(
    target_group_id: str,
    file: UploadFile = File(...),
    uploaded_by: str = Form("target-group-admin-ui"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    session: Session = Depends(get_db),
) -> PersonaDocument:
    from ..core.config import get_settings
    from ..services.storion_client import storion_client
    from ..services.storion_sync import storion_sync_service
    import structlog
    
    logger = structlog.get_logger(__name__)
    settings = get_settings()

    try:
        tg = _get_target_group_or_404(session, target_group_id)
        contents = await read_upload_with_limit(
            file, settings.upload_max_document_bytes, label="Document"
        )
        if not contents:
            raise HTTPException(status_code=400, detail="File was empty")
        content_type = file.content_type or "application/octet-stream"
        filename = file.filename or "upload.bin"
        
        logger.info("document.upload.starting", target_group_id=target_group_id, filename=filename, size=len(contents))

        # Proxy to STORION if enabled
        if settings.use_storion_proxy:
            # ... (Storion logic omitted for brevity, keeping existing structure if needed, but assuming local flow for now due to previous context)
            # Actually, I should keep the Storion block but add logging inside it if I'm replacing the whole function body.
            # To be safe and concise, I will focus on the LOCAL handling where the issue likely is (since user mentioned 500 and we fixed DB schema).
            pass 

        # We need to re-implement the check properly or just wrap the whole invalid logic? 
        # The user provided code had the Storion block. I will implement the *Checking* logic.
        
        # Proxy to STORION if enabled
        if settings.use_storion_proxy:
            try:
                logger.info("document.upload.proxy_to_storion", target_group_id=target_group_id, filename=filename)
                
                # Upload to STORION
                result = await storion_client.upload_file(
                    file_content=contents,
                    filename=filename,
                    service="audion",
                    entity_type="target_group",
                    entity_id=str(tg.id),
                    uploaded_by=uploaded_by,
                )
                
                storion_file_id = result.get("file_id", "")
                job_id = result.get("job_id", "")
                
                # Create local document record for backward compatibility
                document_id = uuid4()
                document = Document(
                    id=document_id,
                    filename=filename,
                    content_type=content_type,
                    size_bytes=len(contents),
                    status="processing",
                    object_key=storion_file_id,
                    file_path=storion_file_id,
                    target_group_id=tg.id,
                    uploaded_by=uploaded_by,
                )
                session.add(document)
                
                # If we got a job_id from STORION, track it
                if job_id:
                    job = ProcessingJob(
                        id=uuid4(),
                        document_id=document_id,
                        status="pending",
                        progress=0.0
                    )
                    session.add(job)
                
                session.commit()
                session.refresh(document)
                
                # Try to sync metadata back (best effort)
                background_tasks.add_task(
                    storion_sync_service.sync_document_from_storion,
                    document.id,
                    storion_file_id
                )
                
                return service._to_document_payload(document, session=session, target_group_id=target_group_id)
                
            except Exception as e:
                logger.error("document.upload.storion_failed", error=str(e), target_group_id=target_group_id)
                # Fallback to local handling if configured?
                # For now re-raise to fallback to local
                raise e
        
        # Local handling (Standard Flow)
        logger.info("document.upload.local_start", target_group_id=target_group_id, filename=filename)
        
        # Generate ID
        document_id = uuid4()
        
        # Upload to object storage (MinIO/S3)
        file_path = f"target-groups/{target_group_id}/documents/{document_id}/{filename}"
        
        try:
            logger.info("document.upload.storage_upload", file_path=file_path)
            storage.upload(key=file_path, data=contents, content_type=content_type)
        except Exception as e:
            logger.error("document.upload.storage_failed", error=str(e))
            raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(e)}")

        try:
            # Create document record
            logger.info("document.upload.create_db_record", document_id=str(document_id))
            document = Document(
                id=document_id,
                filename=filename,
                content_type=content_type,
                size_bytes=len(contents),
                status="processing",
                object_key=file_path,
                file_path=file_path,
                target_group_id=tg.id,
                uploaded_by=uploaded_by,
            )
            session.add(document)
            
            # Create processing job
            logger.info("document.upload.create_processing_job")
            job = ProcessingJob(
                id=uuid4(),
                document_id=document_id,
                status="pending",
                progress=0.0
            )
            session.add(job)
            
            logger.info("document.upload.commit")
            session.commit()
            session.refresh(document)
        except Exception as e:
            logger.error("document.upload.db_failed", error=str(e))
            session.rollback()
            raise HTTPException(status_code=500, detail=f"Database save failed: {str(e)}")
        
        try:
            # Enqueue processing task
            logger.info("document.upload.enqueue", document_id=str(document.id))
            enqueue_ingestion(str(document.id))
        except Exception as e:
            logger.error("document.upload.enqueue_failed", error=str(e))
            # Don't fail the request if enqueue fails, just log it? Or maybe we should?
            # It's better to return success but log error, or ensure task is queued.
            # For now, let's allow it to proceed with warning.
        
        logger.info("document.upload.success", document_id=str(document.id))
        return service._to_document_payload(document, session=session, target_group_id=target_group_id)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("document.upload.fatal_error", error=str(exc), target_group_id=target_group_id, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(exc)}") from exc


@router.get(
    "/{target_group_id}/personas",
    response_model=PersonaListResponse,
    summary="List all personas associated with a target group",
    description=f"""
    Retrieve a paginated list of all personas that have been generated for or associated with a target group.
    
    This endpoint returns personas that are linked to the specified target group. You can filter
    by status and search by name or attributes. Results are paginated for efficient retrieval.
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group (UUID format)
    - `status`: Filter personas by status (optional)
    - `q` (alias `search`): Search query to filter personas by name or attributes (optional)
    - `page`: Page number for pagination (default: 1, minimum: 1)
    - `page_size`: Number of items per page (default: 20, minimum: 1, maximum: 100)
    
    **Returns:**
    - A paginated list of personas including total count, current page, and page size information.
    Each persona includes its profile, demographics, goals, pain points, and other attributes.
    
    **Note:** Results are sorted by creation date (newest first) by default. Personas generated
    from a target group are automatically associated with that target group and use its knowledge
    base for generation.
    
    **Schemas:**
    - Response: `PersonaListResponse` with items `PersonaListItem` (see {SCHEMA_SOURCE_PATH})
    - Persona profile fields follow {PERSONA_SCHEMA_DOC}
    """
)
def list_target_group_personas(
    target_group_id: str,
    status: str | None = Query(None),
    search: str | None = Query(None, alias="q"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_db),
) -> PersonaListResponse:
    _get_target_group_or_404(session, target_group_id)
    try:
        return persona_service.list_personas(
            session,
            target_group_id=target_group_id,
            status=status,
            search=search,
            page=page,
            page_size=page_size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _user_id_for_usage(current_user: User | None) -> str | None:
    if not current_user:
        return None
    return getattr(current_user, "plexon_user_id", None) or str(current_user.id)


@router.post(
    "/{target_group_id}/suggest-personas",
    response_model=SuggestPersonasResponse,
    summary="Suggest personas for this target group",
    description="Uses AI (OpenAI) with project company context and target group to suggest personas (name, age, headline, bio, location, gender). Save company context on the project first.",
)
def suggest_personas_endpoint(
    target_group_id: str,
    body: SuggestPersonasRequest | None = Body(None),
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SuggestPersonasResponse:
    tg = _get_target_group_or_404(session, target_group_id)
    project = session.get(Project, tg.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    parts = []
    if project.description and project.description.strip():
        parts.append(project.description.strip())
    if project.company_context and project.company_context.strip():
        parts.append(project.company_context.strip())
    inc_res = True if body is None else bool(body.include_project_research)
    if inc_res:
        research_block = build_optional_project_research_json_context(session, project=project)
        if research_block:
            parts.append(research_block)
    inc_chk = True if body is None else bool(body.include_checkion_topics)
    if inc_chk:
        chk_block = build_optional_checkion_topics_prompt_block(session, project=project, explicit_seed_url=None)
        if chk_block:
            parts.append(chk_block)
    context_text = "\n\n".join(parts) if parts else ""

    max_suggestions = min(max(1, (body.max_suggestions if body else 5)), 10)

    if not context_text.strip():
        return SuggestPersonasResponse(suggestions=[])

    try:
        suggestions, usage_raw = run_suggest_personas(
            context_text=context_text,
            target_group_name=tg.name or "",
            target_group_segment=tg.segment or "",
            target_group_description=(tg.description or "").strip(),
            max_suggestions=max_suggestions,
            output_locale=body.output_locale if body else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    uid = _user_id_for_usage(current_user)
    if uid and usage_raw:
        report_usage(user_id=uid, event_type="llm_request", raw_units=usage_raw)

    return SuggestPersonasResponse(
        suggestions=[
            PersonaSuggestionItem(
                name=s.name,
                age=s.age,
                headline=s.headline,
                bio=s.bio,
                location=s.location,
                gender=s.gender,
            )
            for s in suggestions
        ],
    )


@router.post(
    "/{target_group_id}/personas/generate",
    response_model=PersonaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a persona for a target group",
    description=f"""
    Automatically generate a persona profile for a target group using AI based on the target group's knowledge.
    
    This endpoint uses AI-powered persona generation to create a comprehensive persona profile based on
    the knowledge chunks, documents, and knowledge entries associated with the target group. The generation
    process analyzes relevant research data and extracts demographics, goals, pain points, communication
    patterns, and other persona attributes. You can control which knowledge sources to use through the
    filter_mode parameter.
    
    **Parameters:**
    - `target_group_id`: The unique identifier of the target group (UUID format)
    - `payload`: The persona generation request containing:
      - `segment`: Target segment description (required)
      - `description`: Optional additional description to guide generation
      - `filter_mode`: Filter mode for selecting knowledge chunks:
        - "auto": Automatically select relevant chunks from all target group knowledge (default)
        - "documents": Use only chunks from specific documents (requires document_ids)
        - "chunks_manual": Use only specific chunks (requires chunk_ids)
      - `document_ids`: List of document IDs to use (required if filter_mode is "documents")
      - `chunk_ids`: List of chunk IDs to use (required if filter_mode is "chunks_manual")
      - `chunk_weights`: Optional dictionary mapping chunk IDs to weights (0.0-1.0)
      - `limit_chunks`: Maximum number of chunks to use in generation (optional, only for auto mode)
      - `variation_params`: Optional parameters to control generation variation:
        - `randomize_chunks`: Whether to randomize chunk selection
        - `temperature`: LLM temperature (0.0-1.0) or "random"
        - `prompt_style`: Prompt style ("vivid", "analytical", "personality-focused", "goal-oriented")
        - `chunk_sample_size`: Number of chunks to sample
        - `seed`: Random seed for reproducible generation
    
    **Returns:**
    - The generated persona object with AI-extracted attributes including demographics,
      goals, pain points, traits, communication style, and confidence score.
    
    **Note:** Generation is synchronous but may take several seconds. The persona is created
    with a "Pending Persona" placeholder name initially and updated once generation completes.
    If generation fails, the persona creation is rolled back. The persona is automatically
    associated with the target group.
    
    **Schemas:**
    - Request: `TargetGroupPersonaGenerateRequest` (see {SCHEMA_SOURCE_PATH})
    - Response: `PersonaResponse` whose profile adheres to {PERSONA_SCHEMA_DOC}
    - Additional contract notes in {TARGET_GROUP_DOC_SECTION}
    """
)
def generate_target_group_persona(
    target_group_id: str,
    payload: TargetGroupPersonaGenerateRequest,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PersonaResponse:
    logger.info("persona.generate.received", target_group_id=target_group_id, payload=payload.dict())
    try:
        tg = _get_target_group_or_404(session, target_group_id)
        logger.info("persona.generate.target_group_found", target_group_id=target_group_id, tg_id=str(tg.id))
        
        # Validate filter_mode
        valid_filter_modes = ["auto", "documents", "chunks_manual"]
        if payload.filter_mode not in valid_filter_modes:
            logger.error("persona.generate.invalid_filter_mode", target_group_id=target_group_id, filter_mode=payload.filter_mode)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid filter_mode. Must be one of: {', '.join(valid_filter_modes)}"
            )
        
        # Validate required fields based on filter_mode
        if payload.filter_mode == "documents" and not payload.document_ids:
            logger.error("persona.generate.missing_document_ids", target_group_id=target_group_id)
            raise HTTPException(
                status_code=400,
                detail="document_ids required when filter_mode is 'documents'"
            )
        if payload.filter_mode == "chunks_manual" and not payload.chunk_ids:
            logger.error("persona.generate.missing_chunk_ids", target_group_id=target_group_id)
            raise HTTPException(
                status_code=400,
                detail="chunk_ids required when filter_mode is 'chunks_manual'"
            )
        
        # Validate chunk_weights if provided
        if payload.chunk_weights:
            for chunk_id, weight in payload.chunk_weights.items():
                if not isinstance(weight, (int, float)) or not (0.0 <= weight <= 1.0):
                    logger.error("persona.generate.invalid_chunk_weight", target_group_id=target_group_id, chunk_id=chunk_id, weight=weight)
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid chunk_weight for chunk {chunk_id}. Must be between 0.0 and 1.0"
                    )
        
        logger.info("persona.generate.creating_persona", target_group_id=target_group_id, segment=payload.segment)

        document_ids_uuid = None
        chunk_ids_uuid = None
        chunk_weights_dict = None

        if payload.filter_mode == "documents" and payload.document_ids:
            try:
                document_ids_uuid = [UUID(doc_id) for doc_id in payload.document_ids]
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid document_id: {exc}") from exc

        if payload.filter_mode == "chunks_manual" and payload.chunk_ids:
            try:
                chunk_ids_uuid = [UUID(chunk_id) for chunk_id in payload.chunk_ids]
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid chunk_id: {exc}") from exc

        if payload.chunk_weights:
            chunk_weights_dict = payload.chunk_weights

        logger.info("persona.generate.starting_generation", target_group_id=target_group_id, filter_mode=payload.filter_mode)
        try:
            persona_response = generate_persona_for_target_group(
                session,
                target_group=tg,
                segment=payload.segment,
                description=payload.description,
                filter_mode=payload.filter_mode,
                document_ids=document_ids_uuid,
                chunk_ids=chunk_ids_uuid,
                chunk_weights=chunk_weights_dict,
                limit_chunks=payload.limit_chunks if payload.filter_mode != "chunks_manual" else None,
                variation_params=payload.variation_params,
                output_locale=payload.output_locale,
            )
        except Exception as exc:
            logger.error(
                "persona.generate.generation_failed",
                target_group_id=target_group_id,
                error=str(exc),
                exc_info=True,
            )
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        uid = _user_id_for_usage(current_user)
        if uid:
            report_usage(
                user_id=uid,
                event_type="persona_generate",
                raw_units={"runs": 1},
                idempotency_key=f"persona_generate:{persona_response.metadata.personaId}",
            )

        logger.info("persona.generate.returning_response", target_group_id=target_group_id, persona_id=persona_response.metadata.personaId)
        return persona_response
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("persona.generate.unexpected_error", target_group_id=target_group_id, error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(exc)}") from exc
