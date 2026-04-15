from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from msqdx_glass_proto import (
    ChatEvent,
    PersonaProfile,
    PersonaPrompt,
    UploadJobStatus,
)

# Import Journey schemas
from .journey import (
    JourneyBase,
    JourneyCreate,
    JourneyGenerateRequest,
    ProjectGenerateJourneyRequest,
    JourneyAiGenerateRequest,
    JourneyAiGenerationResponse,
    JourneyAiSuggestion,
    JourneyResponse,
    PhaseBase,
    PhaseCreate,
    PhaseResponse,
    ElementCreate,
    ElementResponse,
    ExpectationCreate,
    ExpectationResponse,
    MeasurementSummary,
    MeasurementResponse,
    ValidationRequest,
    FrictionPoint,
    PhaseValidationResult,
    JourneyValidationReport,
    InsightResponse,
    ChangeResponse,
)

from .ai import (
    AiAssistRequest,
    AiAssistResponse,
    AiAssistSuggestion,
    AiProvider,
    AiPromptTestRequest,
    AiTemplateDefinition,
    AiTemplateSummary,
    AiTemplateUpdateRequest,
)

from .auth import (
    AuthLoginRequest,
    AuthMeResponse,
    AuthPasswordUpdateRequest,
    AuthPlexonSyncRequest,
    AuthProfileUpdateRequest,
    AuthRegisterRequest,
    AuthTokenCreateRequest,
    AuthTokenResponse,
    UserResponse,
)

from .projects import (
    ProjectCreateRequest,
    ProjectDetailResponse,
    ProjectEasySetupPersonaSummary,
    ProjectEasySetupRequest,
    ProjectEasySetupResponse,
    ProjectEasySetupTargetGroupSummary,
    ProjectListResponse,
    ProjectMemberAddRequest,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectUpdateRequest,
    SuggestTargetGroupsRequest,
    SuggestTargetGroupsResponse,
    TargetGroupSuggestionItem,
)
from .persona_suggest import (
    PersonaSuggestionItem,
    SuggestPersonasRequest,
    SuggestPersonasResponse,
)


class DocumentUploadResponse(BaseModel):
    job_id: str = Field(..., description="Identifier of the asynchronous ingestion job created for the uploaded document.")


class PersonaGenerateRequest(BaseModel):
    segment: str = Field(..., description="High-level segment or persona archetype to generate.")
    project_id: str = Field(..., description="Project identifier the generated persona should belong to.")
    persona_id: str | None = Field(
        default=None,
        description="Optional stable persona identifier to reuse; random UUID is generated when omitted.",
    )


class TargetGroupPersonaGenerateRequest(BaseModel):
    segment: str = Field(..., description="Short label that captures the persona’s target audience segment (e.g., 'CFO Skeptic').")
    description: str | None = Field(
        default=None,
        description="Long-form hint that provides extra context to the generator.",
    )
    
    # Knowledge-Filter Optionen
    filter_mode: str = Field(
        default="auto",
        description="Controls which knowledge chunks feed the generator: auto, documents, or chunks_manual.",
    )
    document_ids: List[str] | None = Field(
        default=None,
        description="Explicit list of document IDs to pull chunks from when filter_mode='documents'.",
    )
    chunk_ids: List[str] | None = Field(
        default=None,
        description="Explicit list of chunk IDs to include when filter_mode='chunks_manual'.",
    )
    chunk_weights: Dict[str, float] | None = Field(
        default=None,
        description="Optional per-chunk weight overriding default relevance scoring.",
    )
    
    # Variation-Parameter
    variation_params: Dict[str, Any] | None = Field(
        default=None,
        description="LLM tuning parameters such as temperature, traits, or prompt style overrides.",
    )
    
    # Limits
    limit_chunks: int = Field(
        50,
        ge=1,
        le=200,
        description="Maximum number of knowledge chunks forwarded to the persona generator.",
    )


class PersonaDocument(BaseModel):
    id: str = Field(..., description="Unique document identifier (UUID).")
    filename: str = Field(..., description="Original filename supplied during upload.")
    contentType: str = Field(..., description="MIME type detected or provided for the file.")
    sizeBytes: float = Field(..., description="File size in bytes.")
    uploadedAt: datetime = Field(..., description="Timestamp when the document was uploaded.")
    uploadedBy: str | None = Field(
        default=None,
        description="Identifier (user or service) that uploaded the document.",
    )
    downloadUrl: str | None = Field(
        default=None,
        description="Pre-signed URL or API endpoint used to fetch the document content.",
    )
    insightSummary: str | None = Field(
        default=None,
        description="Optional short summary extracted from the document for quick preview.",
    )
    ingestionStatus: str | None = Field(
        default=None,
        description="State of the ingestion pipeline for this document (pending/processing/completed/failed).",
    )
    ingestionProgress: float | None = Field(
        default=None,
        description="Percentage progress of the ingestion job (0-100).",
    )


class PersonaKnowledgeUpsertRequest(BaseModel):
    title: str = Field(..., description="Short heading for the knowledge entry.")
    content: str = Field(..., description="Full textual content of the knowledge entry.")
    metadata: Dict[str, Any] | None = Field(
        default=None,
        description="Optional flat metadata dictionary (e.g., tags, source references).",
    )
    created_by: str = Field(
        default="system",
        description="Identifier of the actor who created/updated the entry (defaults to system).",
    )


class PersonaKnowledgeEntry(BaseModel):
    id: str = Field(..., description="Unique identifier of the knowledge entry (UUID).")
    personaId: str = Field(..., description="Persona identifier the knowledge entry belongs to.")
    title: str = Field(..., description="Heading for the entry, matching the upsert request.")
    content: str = Field(..., description="Stored text body of the knowledge entry.")
    metadata: Dict[str, Any] | None = Field(
        default=None,
        description="Flat metadata payload stored alongside the entry.",
    )
    createdBy: str = Field(..., description="User or service that created the entry.")
    createdAt: datetime = Field(..., description="Timestamp of creation (UTC).")


class PersonaMetadata(BaseModel):
    personaId: str = Field(..., description="Unique persona identifier (UUID).")
    projectId: str = Field(..., description="Project identifier the persona belongs to.")
    status: str = Field(..., description="Lifecycle status (draft, published, archived, etc.).")
    version: str = Field(..., description="Semantic version for persona revisions.")
    confidence: float = Field(..., description="Confidence score in the persona’s quality (0-1).")
    updatedAt: datetime = Field(..., description="Timestamp of the most recent update.")
    updatedBy: str | None = Field(
        default=None,
        description="Identifier of the user or service that last updated the persona.",
    )
    lastReviewedAt: datetime | None = Field(
        default=None,
        description="Timestamp of the last manual review, if any.",
    )
    imageUrl: str | None = Field(
        default=None,
        description="Public URL pointing to a representative persona image.",
    )
    avatarUrl: str | None = Field(
        default=None,
        description="Public URL pointing to the avatar asset served via the backend.",
    )
    consoleUrl: str = Field(..., description="Deep link to the persona within the admin console.")
    lockedBy: str | None = Field(
        default=None,
        description="User identifier that currently holds the edit lock.",
    )
    lockedAt: datetime | None = Field(
        default=None,
        description="Timestamp when the persona was locked for editing.",
    )
    graphUrl: str | None = Field(
        default=None,
        description="Optional link to the persona’s graph visualization (Neo4j browser).",
    )
    graphBloomUrl: str | None = Field(
        default=None,
        description="Optional link to the persona’s Bloom visualization.",
    )
    targetGroupId: str | None = Field(
        default=None,
        description="Target group the persona is assigned to, if any.",
    )
    tavusReplicaId: str | None = Field(
        default=None,
        description="Tavus replica ID for conversational video (CVI) if configured.",
    )
    tavusPersonaId: str | None = Field(
        default=None,
        description="Optional Tavus persona ID for video chat.",
    )


class PersonaInsight(BaseModel):
    relatedChunkIds: List[str] = Field(
        default_factory=list,
        description="List of knowledge chunk IDs that informed the insight computation.",
    )
    graphRelationships: List[dict] = Field(
        default_factory=list,
        description="Graph relationships (nodes/edges) associated with the persona.",
    )


class PersonaListItem(BaseModel):
    id: str = Field(..., description="Persona identifier (UUID).")
    projectId: str = Field(..., description="Project identifier the persona belongs to.")
    name: str = Field(..., description="Human-readable persona name.")
    segment: str = Field(..., description="High-level customer segment the persona represents.")
    headline: str = Field(..., description="Short role/title tagline for the persona.")
    status: str = Field(..., description="Current lifecycle status (draft, published, archived, etc.).")
    confidence: float = Field(..., description="Confidence score aligned with persona metadata.")
    version: str = Field(..., description="Semantic version string.")
    updatedAt: datetime = Field(..., description="Timestamp of the latest modification.")
    updatedBy: str | None = Field(
        default=None,
        description="Identifier of the actor responsible for the last change.",
    )
    imageUrl: str | None = Field(
        default=None,
        description="Optional public URL of the persona’s image.",
    )
    avatarUrl: str | None = Field(
        default=None,
        description="Optional URL for the avatar asset served by the backend.",
    )
    profileCard: Dict[str, Any] | None = Field(
        default=None,
        description="Lightweight profile card payload for list rendering.",
    )
    profile: PersonaProfile | None = Field(
        default=None,
        description="Full PersonaProfile message from `msqdx_glass_proto` when included.",
    )
    prompt: PersonaPrompt | None = Field(
        default=None,
        description="Optional persona prompt definition for LLM workflows.",
    )


class PersonaListResponse(BaseModel):
    items: List[PersonaListItem] = Field(..., description="Current page of persona list items.")
    total: int = Field(..., description="Total personas that match the filter criteria.")
    page: int = Field(..., description="Current page index (1-based).")
    page_size: int = Field(..., description="Number of items returned per page.")


class TargetGroupBase(BaseModel):
    name: str = Field(..., description="Human-readable name for the target group.")
    description: str | None = Field(
        default=None,
        description="Optional long-form description that explains the group’s scope.",
    )
    segment: str = Field(..., description="Segment identifier shared by personas in the group.")


class TargetGroupCreateRequest(TargetGroupBase):
    project_id: str = Field(..., description="Project identifier the target group belongs to.")


class TargetGroupUpdateRequest(BaseModel):
    name: str | None = Field(
        default=None,
        description="Updated name for the target group (leave unset to keep current value).",
    )
    description: str | None = Field(
        default=None,
        description="Updated description for the group.",
    )
    segment: str | None = Field(
        default=None,
        description="Updated segment identifier.",
    )
    updated_by: str | None = Field(
        default=None,
        description="Identifier of the actor issuing the update (stored for audit trail).",
    )


class TargetGroupListItem(BaseModel):
    id: str = Field(..., description="Target group identifier (UUID).")
    name: str = Field(..., description="Display name for the target group.")
    segment: str = Field(..., description="Shared segment used for personas in the group.")
    description: str | None = Field(
        default=None,
        description="Optional description text.",
    )
    persona_count: int = Field(
        0,
        description="Number of personas currently associated with the group.",
    )
    knowledge_entry_count: int = Field(
        0,
        description="Number of knowledge entries attached to the group.",
    )
    created_at: datetime = Field(..., description="Creation timestamp (UTC).")
    updated_at: datetime = Field(..., description="Last update timestamp (UTC).")


class TargetGroupListResponse(BaseModel):
    items: List[TargetGroupListItem] = Field(..., description="Page of target group summaries.")
    total: int = Field(..., description="Total count of groups that satisfy the filters.")
    page: int = Field(..., description="Current page number (1-indexed).")
    page_size: int = Field(..., description="Number of results per page.")


class TargetGroupResponse(BaseModel):
    id: str = Field(..., description="Target group identifier (UUID).")
    project_id: str = Field(..., description="Project identifier the group belongs to.")
    name: str = Field(..., description="Display name for the group.")
    segment: str = Field(..., description="Shared persona segment label.")
    description: str | None = Field(
        default=None,
        description="Optional detail describing the group.",
    )
    personas: List[PersonaListItem] = Field(
        default_factory=list,
        description="Personas currently linked to the target group.",
    )
    knowledge_entries: List[PersonaKnowledgeEntry] = Field(
        default_factory=list,
        description="Manual knowledge entries tied to the group.",
    )
    sources: List[dict] = Field(
        default_factory=list,
        description="Source attribution records per chunk (contains chunk_id, relevance_score).",
    )
    created_at: datetime = Field(..., description="Creation timestamp (UTC).")
    updated_at: datetime = Field(..., description="Latest update timestamp (UTC).")


class TargetGroupKnowledgeUpsertRequest(BaseModel):
    title: str = Field(..., description="Short heading for the knowledge entry.")
    content: str = Field(..., description="Full text content for the knowledge entry.")
    metadata: Dict[str, Any] | None = Field(
        default=None,
        description="Optional structured metadata (flat key/value).",
    )
    created_by: str = Field(
        default="system",
        description="Actor identifier recorded for auditing (defaults to system).",
    )


class ProcessingJobListItem(BaseModel):
    id: str = Field(..., description="Processing job identifier (UUID).")
    document_id: str = Field(..., description="Document identifier this job refers to.")
    status: str = Field(..., description="Job state: pending, processing, completed, or failed.")
    progress: float = Field(..., description="Completion percentage ranging from 0 to 100.")
    error: str | None = Field(
        default=None,
        description="Last error message if the job failed.",
    )
    created_at: datetime = Field(..., description="Timestamp when the job was created.")
    updated_at: datetime = Field(..., description="Timestamp of the latest job update.")


class ProcessingJobListResponse(BaseModel):
    items: List[ProcessingJobListItem] = Field(..., description="Page of processing job summaries.")
    total: int = Field(..., description="Total job count matching the filters.")
    page: int = Field(..., description="Current page number (1-based).")
    page_size: int = Field(..., description="Number of entries per page.")


class ProcessingJobDetailResponse(BaseModel):
    id: str = Field(..., description="Processing job identifier (UUID).")
    document_id: str = Field(..., description="Document identifier associated with this job.")
    document_filename: str | None = Field(
        default=None,
        description="Original filename of the document.",
    )
    document_size_bytes: float | None = Field(
        default=None,
        description="Size of the document in bytes.",
    )
    status: str = Field(..., description="Job state (pending/processing/completed/failed).")
    progress: float = Field(..., description="Completion percentage ranging from 0 to 100.")
    error: str | None = Field(
        default=None,
        description="Error message for failed jobs.",
    )
    created_at: datetime = Field(..., description="Timestamp when the job was created.")
    updated_at: datetime = Field(..., description="Timestamp when the job last changed.")
    celery_task_id: str | None = Field(
        default=None,
        description="Underlying Celery task identifier, if available.",
    )


class CeleryTaskStatus(BaseModel):
    task_id: str = Field(..., description="Celery task identifier.")
    status: str = Field(..., description="Celery status (PENDING, STARTED, SUCCESS, FAILURE, RETRY, REVOKED).")
    result: Any | None = Field(
        default=None,
        description="Serialized task result when available.",
    )
    error: str | None = Field(
        default=None,
        description="Error message when the task failed.",
    )
    traceback: str | None = Field(
        default=None,
        description="Captured traceback for failed tasks.",
    )
    started_at: datetime | None = Field(
        default=None,
        description="Timestamp when the task started execution.",
    )
    completed_at: datetime | None = Field(
        default=None,
        description="Timestamp when the task completed (success or failure).",
    )


class QueueStatsResponse(BaseModel):
    pending_count: int = Field(..., description="Number of jobs currently pending.")
    processing_count: int = Field(..., description="Number of jobs in progress.")
    completed_count: int = Field(..., description="Number of successfully completed jobs.")
    failed_count: int = Field(..., description="Number of failed jobs.")
    worker_available: bool = Field(..., description="Indicates whether at least one worker is healthy.")
    worker_count: int = Field(0, description="Number of workers detected as available.")


class ServiceStatus(BaseModel):
    name: str = Field(..., description="Service name.")
    status: str = Field(..., description="Service status: 'up', 'down', or 'unknown'.")
    message: str | None = Field(default=None, description="Optional status message or error.")


class ServiceStatusResponse(BaseModel):
    services: List[ServiceStatus] = Field(..., description="List of service statuses.")
    all_services_up: bool = Field(..., description="True if all critical services are up.")


class LogEntry(BaseModel):
    level: str = Field(..., description="Log severity (DEBUG, INFO, WARNING, ERROR).")
    message: str = Field(..., description="Log message text.")
    timestamp: datetime = Field(..., description="Timestamp when the log entry was recorded.")
    context: Dict[str, Any] | None = Field(
        default=None,
        description="Optional structured context payload serialized with the log entry.",
    )
    job_id: str | None = Field(
        default=None,
        description="Processing job identifier related to the log entry, if applicable.",
    )
    document_id: str | None = Field(
        default=None,
        description="Document identifier related to the log entry, if applicable.",
    )


class LogListResponse(BaseModel):
    items: List[LogEntry] = Field(..., description="Page of log entries.")
    total: int = Field(..., description="Total number of log entries for the query.")
    page: int = Field(..., description="Current page number (1-indexed).")
    page_size: int = Field(..., description="Number of log entries per page.")


class PersonaCreateRequest(BaseModel):
    project_id: str = Field(..., description="Project identifier the persona should belong to.")
    name: str = Field(..., description="Display name assigned to the persona.")
    segment: str = Field(..., description="Customer segment or archetype label.")
    headline: str = Field(..., description="Short headline summarizing the persona’s role or focus.")
    target_group_id: str | None = Field(
        default=None,
        description="Optional target group identifier to associate the persona with.",
    )
    profile: PersonaProfile | None = Field(
        default=None,
        description="Full persona profile payload if created externally.",
    )
    confidence: float = Field(0.7, description="Initial confidence score between 0 and 1.")
    version: str = Field("1.0.0", description="Semantic version for the persona document.")
    status: str | None = Field(
        default=None,
        description="Lifecycle status override (defaults to backend-defined value).",
    )
    updated_by: str | None = Field(
        default=None,
        description="Actor identifier stored for auditing.",
    )
    prompt: PersonaPrompt | None = Field(
        default=None,
        description="Optional persona prompt definition for LLM workflows.",
    )
    image_url: str | None = Field(
        default=None,
        description="URL pointing to the persona’s image asset.",
    )


class PersonaPatchRequest(BaseModel):
    name: Optional[str] = Field(default=None, description="New persona name.")
    segment: Optional[str] = Field(default=None, description="Updated segment label.")
    headline: Optional[str] = Field(default=None, description="Updated persona headline.")
    profile: Optional[PersonaProfile] = Field(
        default=None,
        description="Updated persona profile payload.",
    )
    confidence: Optional[float] = Field(
        default=None,
        description="Updated confidence score (0-1).",
    )
    version: Optional[str] = Field(default=None, description="Updated semantic version.")
    status: Optional[str] = Field(default=None, description="Updated lifecycle status.")
    updated_by: Optional[str] = Field(
        default=None,
        description="Actor identifier performing the update.",
    )
    last_reviewed_at: Optional[datetime] = Field(
        default=None,
        description="Timestamp for the latest manual review event.",
    )
    image_url: Optional[str] = Field(
        default=None,
        description="Replacement image URL.",
    )
    locked_by: Optional[str] = Field(
        default=None,
        description="User currently locking the persona for editing.",
    )
    locked_at: Optional[datetime] = Field(
        default=None,
        description="Timestamp when the lock was acquired.",
    )
    prompt: Optional[PersonaPrompt] = Field(
        default=None,
        description="Updated persona prompt definition.",
    )
    project_id: Optional[str] = Field(
        default=None,
        description="Project to assign the persona to (must be accessible to the user).",
    )
    target_group_id: Optional[str] = Field(
        default=None,
        description="Target group to assign the persona to (optional; must belong to the project).",
    )
    tavus_replica_id: Optional[str] = Field(
        default=None,
        description="Tavus replica ID for video chat (CVI).",
    )
    tavus_persona_id: Optional[str] = Field(
        default=None,
        description="Optional Tavus persona ID for video chat.",
    )


class PersonaResponse(BaseModel):
    profile: PersonaProfile = Field(..., description="Complete persona profile payload.")
    prompt: PersonaPrompt = Field(..., description="Prompt object describing how to render/use the persona.")
    sources: List[dict] = Field(..., description="List of knowledge sources referencing chunk IDs and metadata.")
    metadata: PersonaMetadata = Field(..., description="Operational metadata for the persona resource.")
    documents: List[PersonaDocument] = Field(
        default_factory=list,
        description="Documents uploaded to the persona.",
    )
    knowledge: List[PersonaKnowledgeEntry] = Field(
        default_factory=list,
        description="Manual knowledge entries linked to the persona.",
    )
    insights: PersonaInsight | None = Field(
        default=None,
        description="Aggregated insights including graph context and chunk references.",
    )


class KnowledgeChunk(BaseModel):
    id: str = Field(..., description="Knowledge chunk identifier (UUID).")
    content: str = Field(..., description="Chunk text content.")
    document_id: str = Field(..., description="Document identifier the chunk originated from.")
    document_filename: str | None = Field(
        default=None,
        description="Original filename of the source document.",
    )
    relevance_score: float = Field(..., description="Relevance score assigned during ingestion.")
    metadata: Dict[str, Any] | None = Field(
        default=None,
        description="Optional metadata payload for the chunk.",
    )
    x: float | None = Field(
        default=None,
        description="2D embedding coordinate (x) used for visualization.",
    )
    y: float | None = Field(
        default=None,
        description="2D embedding coordinate (y) used for visualization.",
    )
    cluster_id: int | None = Field(
        default=None,
        description="Cluster identifier assigned by clustering endpoints.",
    )


class KnowledgeCluster(BaseModel):
    id: int = Field(..., description="Cluster identifier.")
    topic: str = Field(..., description="Human-friendly topic label for the cluster.")
    description: str = Field(..., description="Summary of what the cluster represents.")
    size: int = Field(..., description="Number of chunks inside the cluster.")
    chunk_ids: List[str] = Field(..., description="List of chunk IDs assigned to this cluster.")


class ClusterResult(BaseModel):
    clusters: List[KnowledgeCluster] = Field(..., description="Aggregated cluster metadata.")
    chunks: List[KnowledgeChunk] = Field(..., description="Chunks annotated with cluster information.")
    coordinates_2d: List[List[float]] = Field(
        ...,
        description="2D coordinates array used for plotting (one [x,y] per chunk).",
    )
    cluster_labels: List[int] = Field(
        ...,
        description="Cluster assignment index for each chunk in the same order as `chunks`.",
    )
    method: str = Field(..., description="Clustering algorithm used (kmeans or dbscan).")


class SimilarChunk(BaseModel):
    id: str = Field(..., description="Chunk identifier for the similar result.")
    content: str = Field(..., description="Chunk content text.")
    similarity: float = Field(..., description="Similarity score between 0 and 1 (1 is identical).")
    document_id: str = Field(..., description="Document identifier the similar chunk belongs to.")


__all__ = [
    "ChatEvent",
    "PersonaProfile",
    "PersonaPrompt",
    "UploadJobStatus",
    "DocumentUploadResponse",
    "PersonaGenerateRequest",
    "PersonaDocument",
    "PersonaKnowledgeEntry",
    "PersonaKnowledgeUpsertRequest",
    "PersonaMetadata",
    "PersonaInsight",
    "PersonaListItem",
    "PersonaListResponse",
    "PersonaCreateRequest",
    "PersonaPatchRequest",
    "PersonaResponse",
    "TargetGroupBase",
    "TargetGroupCreateRequest",
    "TargetGroupUpdateRequest",
    "TargetGroupListItem",
    "TargetGroupListResponse",
    "TargetGroupResponse",
    "TargetGroupKnowledgeUpsertRequest",
    "ProcessingJobListItem",
    "ProcessingJobListResponse",
    "ProcessingJobDetailResponse",
    "CeleryTaskStatus",
    "QueueStatsResponse",
    "ServiceStatus",
    "ServiceStatusResponse",
    "LogEntry",
    "LogListResponse",
    "AiTemplateSummary",
    "AiTemplateUpdateRequest",
    "AuthLoginRequest",
    "AuthMeResponse",
    "AuthPasswordUpdateRequest",
    "AuthPlexonSyncRequest",
    "AuthProfileUpdateRequest",
    "AuthRegisterRequest",
    "AuthTokenCreateRequest",
    "AuthTokenResponse",
    "UserResponse",
    "ProjectCreateRequest",
    "ProjectDetailResponse",
    "ProjectEasySetupPersonaSummary",
    "ProjectEasySetupRequest",
    "ProjectEasySetupResponse",
    "ProjectEasySetupTargetGroupSummary",
    "ProjectListResponse",
    "ProjectMemberAddRequest",
    "KnowledgeChunk",
    "KnowledgeCluster",
    "ClusterResult",
    "SimilarChunk",
    "ProjectMemberResponse",
    "ProjectResponse",
    "ProjectUpdateRequest",
    "SuggestTargetGroupsRequest",
    "SuggestTargetGroupsResponse",
    "TargetGroupSuggestionItem",
    "PersonaSuggestionItem",
    "SuggestPersonasRequest",
    "SuggestPersonasResponse",
    "JourneyAiGenerateRequest",
    "JourneyAiGenerationResponse",
    "JourneyAiSuggestion",
    "AiAssistRequest",
    "AiAssistResponse",
    "AiAssistSuggestion",
    "AiProvider",
    "AiPromptTestRequest",
    "AiTemplateDefinition",
    # Journey schemas
    "JourneyBase",
    "JourneyCreate",
    "JourneyGenerateRequest",
    "ProjectGenerateJourneyRequest",
    "JourneyResponse",
    "PhaseBase",
    "PhaseCreate",
    "PhaseResponse",
    "ElementCreate",
    "ElementResponse",
    "ExpectationCreate",
    "ExpectationResponse",
    "MeasurementSummary",
    "MeasurementResponse",
    "ValidationRequest",
    "FrictionPoint",
    "PhaseValidationResult",
    "JourneyValidationReport",
    "InsightResponse",
    "ChangeResponse",
]
