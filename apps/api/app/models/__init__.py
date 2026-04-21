from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum

from uuid import uuid4

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from ..db import Base


class PersonaStatus(PyEnum):
    draft = "draft"
    published = "published"
    archived = "archived"


class PersonaAuditAction(PyEnum):
    created = "created"
    updated = "updated"
    published = "published"
    archived = "archived"
    restored = "restored"


class JourneyCreationMode(PyEnum):
    manual = "manual"
    ai_generated = "ai_generated"
    hybrid = "hybrid"


class JourneyStatus(PyEnum):
    draft = "draft"
    active = "active"
    validated = "validated"
    archived = "archived"


class JourneyElementType(PyEnum):
    action = "action"
    thought = "thought"
    feeling = "feeling"
    touchpoint = "touchpoint"
    pain_point = "pain_point"
    opportunity = "opportunity"
    question = "question"
    quote = "quote"


class JourneyMetricType(PyEnum):
    sessions = "sessions"
    users = "users"
    page_views = "page_views"
    bounce_rate = "bounce_rate"
    time_on_page = "time_on_page"
    scroll_depth = "scroll_depth"
    engagement_rate = "engagement_rate"
    conversion_rate = "conversion_rate"
    form_submissions = "form_submissions"
    cta_clicks = "cta_clicks"
    cta_click_rate = "cta_click_rate"
    rage_clicks = "rage_clicks"
    u_turns = "u_turns"
    error_clicks = "error_clicks"
    leads = "leads"
    opportunities = "opportunities"
    revenue = "revenue"


class JourneyComparisonOperator(PyEnum):
    equals = "equals"
    not_equals = "not_equals"
    greater_than = "greater_than"
    less_than = "less_than"
    greater_or_equal = "greater_or_equal"
    less_or_equal = "less_or_equal"
    between = "between"


class JourneyMeasurementStatus(PyEnum):
    good = "good"
    warning = "warning"
    critical = "critical"
    no_data = "no_data"


class JourneyInsightType(PyEnum):
    confirmation = "confirmation"
    contradiction = "contradiction"
    discovery = "discovery"
    anomaly = "anomaly"


class JourneyInsightStatus(PyEnum):
    new = "new"
    acknowledged = "acknowledged"
    actioned = "actioned"
    dismissed = "dismissed"


class MoodboardStatus(PyEnum):
    draft = "draft"
    building = "building"
    ready = "ready"
    failed = "failed"


class ProjectRole(PyEnum):
    owner = "owner"
    admin = "admin"
    member = "member"


class ProjectMemberStatus(PyEnum):
    active = "active"
    invited = "invited"


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String(256), nullable=False, unique=True)
    password_hash = Column(String(256), nullable=False)
    name = Column(String(128), nullable=True)
    company = Column(String(256), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    locale = Column(String(8), nullable=True)
    plexon_user_id = Column(String(128), nullable=True)  # PLEXON user id when linked for profile sync
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    owned_projects = relationship("Project", back_populates="owner")
    memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")
    api_tokens = relationship("ApiToken", back_populates="user", cascade="all, delete-orphan")


class ApiToken(Base):
    """API tokens for Bearer auth (MCP, integrations). One token per user for all services."""
    __tablename__ = "api_tokens"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("audion.users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(64), nullable=False)  # SHA-256 hex of raw token
    name = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="api_tokens")


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(128), nullable=False)
    # German mirror display name (optional).
    name_de = Column(String(128), nullable=True)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("audion.users.id"), nullable=False)
    description = Column(Text, nullable=True)
    description_de = Column(Text, nullable=True)
    company_context = Column(Text, nullable=True)
    company_context_de = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="draft")
    # Optional CHECKION project UUID (links AUDION project to CHECKION for Deep Scan slim-pages).
    checkion_project_id = Column(String(40), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="owned_projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")


class AiSuggestionCache(Base):
    """Cached AI suggestions keyed by stable context hash."""

    __tablename__ = "ai_suggestion_cache"
    __table_args__ = (
        UniqueConstraint("project_id", "kind", "context_hash", name="uq_ai_suggestion_cache_key"),
        {"schema": "audion"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("audion.projects.id", ondelete="CASCADE"), nullable=False)
    kind = Column(String(64), nullable=False)  # e.g. "suggest_target_groups"
    context_hash = Column(String(64), nullable=False)  # sha256 hex

    request_payload = Column(JSONB, nullable=False, default=dict)
    response_payload = Column(JSONB, nullable=False, default=dict)
    meta = Column(JSONB, nullable=False, default=dict)  # model, prompt_version, usage, cache notes

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_member"),
        {"schema": "audion"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("audion.projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("audion.users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(ProjectRole, name="project_role"), nullable=False, default=ProjectRole.member)
    status = Column(Enum(ProjectMemberStatus, name="project_member_status"), nullable=False, default=ProjectMemberStatus.active)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="memberships")


class AiTemplateOverride(Base):
    __tablename__ = "ai_template_overrides"
    __table_args__ = (
        UniqueConstraint("project_id", "template_id", name="uq_ai_template_override"),
        {"schema": "audion"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("audion.projects.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(String(128), nullable=False)
    payload = Column(JSONB, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by = Column(String(128), nullable=True)


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    filename = Column(String(512), nullable=False)
    file_path = Column(String(1024), nullable=False)
    content_type = Column(String(128), nullable=False)
    size_bytes = Column(Float, nullable=False)
    status = Column(Enum("pending", "processing", "completed", "failed", name="document_status"), nullable=False)
    object_key = Column(String(512), nullable=True)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("audion.personas.id", ondelete="SET NULL"), nullable=True)
    target_group_id = Column(UUID(as_uuid=True), ForeignKey("audion.target_groups.id", ondelete="SET NULL"), nullable=True)
    uploaded_by = Column(String(128), nullable=True)
    insight_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    chunks = relationship("DocumentChunk", back_populates="document")
    persona = relationship("Persona", back_populates="documents")
    target_group = relationship("TargetGroup", back_populates="documents")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("audion.documents.id"), nullable=False)
    knowledge_entry_id = Column(UUID(as_uuid=True), ForeignKey("audion.target_group_knowledge_entries.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=False)
    chunk_metadata = Column("chunk_metadata", JSONB, nullable=False)

    document = relationship("Document", back_populates="chunks")
    knowledge_entry = relationship("TargetGroupKnowledgeEntry", back_populates="chunks")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("audion.documents.id"), nullable=False)
    status = Column(
        Enum("pending", "processing", "completed", "failed", name="processing_status"),
        nullable=False,
    )
    progress = Column(Float, default=0.0, nullable=False)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    document = relationship("Document")


class TargetGroup(Base):
    __tablename__ = "target_groups"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(128), nullable=False)
    name_de = Column(String(128), nullable=True)
    description = Column(Text, nullable=True)
    description_de = Column(Text, nullable=True)
    segment = Column(String(128), nullable=False)
    segment_de = Column(String(128), nullable=True)
    status = Column(String(32), nullable=False, default="draft")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by = Column(String(128), nullable=True)

    personas = relationship("Persona", back_populates="target_group")
    knowledge_entries = relationship("TargetGroupKnowledgeEntry", back_populates="target_group", cascade="all, delete-orphan")
    sources = relationship("TargetGroupSource", back_populates="target_group", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="target_group")
    journeys = relationship("Journey", back_populates="target_group")


class Persona(Base):
    __tablename__ = "personas"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(128), nullable=False)
    segment = Column(String(128), nullable=False)
    # English (canonical) headline surface stored in DB column `headline`.
    headline = Column(Text, nullable=False)  # TEXT: AI/description can exceed 256 chars
    # German mirror headline (optional until publish-time bilingual validation).
    headline_de = Column(Text, nullable=True)
    profile = Column(JSONB, nullable=False)
    # German mirror of `profile` JSON (same keys/shape; optional until publish validation).
    profile_de = Column(JSONB, nullable=True)
    confidence = Column(Float, nullable=False)
    version = Column(String(32), nullable=False)
    target_group_id = Column(UUID(as_uuid=True), ForeignKey("audion.target_groups.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by = Column(String(128), nullable=True)
    status = Column(
        Enum(PersonaStatus, name="persona_status"),
        default=PersonaStatus.draft,
        nullable=False,
    )
    last_reviewed_at = Column(DateTime, nullable=True)
    locked_by = Column(String(128), nullable=True)
    locked_at = Column(DateTime, nullable=True)
    image_url = Column(Text, nullable=True)  # TEXT to allow data URLs from avatar generation (chat-api)
    image_generated_at = Column(DateTime, nullable=True)
    profile_card = Column(JSONB, nullable=True)
    profile_card_de = Column(JSONB, nullable=True)
    tavus_replica_id = Column(String(256), nullable=True)  # Tavus replica ID for video chat (CVI)
    tavus_persona_id = Column(String(256), nullable=True)  # Optional Tavus persona ID

    target_group = relationship("TargetGroup", back_populates="personas")
    prompt = relationship("PersonaPrompt", uselist=False, back_populates="persona")
    sources = relationship("PersonaSource", back_populates="persona")
    audit_logs = relationship("PersonaAuditLog", back_populates="persona", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="persona")
    moodboards = relationship("PersonaMoodboard", back_populates="persona", cascade="all, delete-orphan")


class PersonaMoodboard(Base):
    __tablename__ = "persona_moodboards"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("audion.personas.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String(256), nullable=False, default="Moodboard")
    status = Column(Enum(MoodboardStatus, name="moodboard_status"), nullable=False, default=MoodboardStatus.draft)
    active = Column(Boolean, nullable=False, default=True)
    style_keywords = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by = Column(String(128), nullable=True)

    persona = relationship("Persona", back_populates="moodboards")
    tiles = relationship("PersonaMoodboardTile", back_populates="moodboard", cascade="all, delete-orphan")


class PersonaMoodboardTile(Base):
    __tablename__ = "persona_moodboard_tiles"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    moodboard_id = Column(UUID(as_uuid=True), ForeignKey("audion.persona_moodboards.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(64), nullable=False)
    image_url = Column(Text, nullable=False)
    thumb_url = Column(Text, nullable=True)
    source_type = Column(String(64), nullable=False, default="openverse")
    source_url = Column(Text, nullable=True)
    author = Column(String(256), nullable=True)
    license = Column(String(256), nullable=True)
    attribution_text = Column(Text, nullable=True)
    caption = Column(Text, nullable=True)
    rationale = Column(Text, nullable=True)
    tags = Column(JSONB, nullable=True)
    tile_order = Column(Integer, nullable=False, default=0)
    locked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    moodboard = relationship("PersonaMoodboard", back_populates="tiles")


class PersonaPrompt(Base):
    __tablename__ = "persona_prompts"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("audion.personas.id"), nullable=False)
    # English (canonical) compact chat system prompt.
    system_prompt = Column(Text, nullable=False)
    # German mirror prompt for single-locale DE chat runtimes (optional until publish validation).
    system_prompt_de = Column(Text, nullable=True)
    template_version = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    template_metadata = Column(JSONB, nullable=True)

    persona = relationship("Persona", back_populates="prompt")


class PersonaSource(Base):
    __tablename__ = "persona_sources"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("audion.personas.id"), nullable=False)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey("audion.document_chunks.id"), nullable=False)
    confidence = Column(Float, nullable=False)
    rationale = Column(Text, nullable=True)

    persona = relationship("Persona", back_populates="sources")


class PersonaAuditLog(Base):
    __tablename__ = "persona_audit_logs"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("audion.personas.id"), nullable=False)
    action = Column(Enum(PersonaAuditAction, name="persona_audit_action"), nullable=False)
    actor = Column(String(128), nullable=False)
    payload_before = Column(JSONB, nullable=True)
    payload_after = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    persona = relationship("Persona", back_populates="audit_logs")


class PersonaKnowledgeEntry(Base):
    __tablename__ = "persona_knowledge_entries"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("audion.personas.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(256), nullable=False)
    content = Column(Text, nullable=False)
    metadata_payload = Column("metadata", JSONB, nullable=True)
    created_by = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TargetGroupSource(Base):
    __tablename__ = "target_group_sources"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    target_group_id = Column(UUID(as_uuid=True), ForeignKey("audion.target_groups.id", ondelete="CASCADE"), nullable=False)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey("audion.document_chunks.id"), nullable=False)
    relevance_score = Column(Float, nullable=False, default=1.0)
    rationale = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    target_group = relationship("TargetGroup", back_populates="sources")


class TargetGroupKnowledgeEntry(Base):
    __tablename__ = "target_group_knowledge_entries"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    target_group_id = Column(UUID(as_uuid=True), ForeignKey("audion.target_groups.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(256), nullable=False)
    content = Column(Text, nullable=False)
    metadata_payload = Column("metadata", JSONB, nullable=True)
    created_by = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    target_group = relationship("TargetGroup", back_populates="knowledge_entries")
    chunks = relationship("DocumentChunk", back_populates="knowledge_entry", cascade="all, delete-orphan")


class Journey(Base):
    __tablename__ = "journeys"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=True)
    target_group_id = Column(UUID(as_uuid=True), ForeignKey("audion.target_groups.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    journey_type = Column(String(128), nullable=False)
    creation_mode = Column(Enum(JourneyCreationMode, name="journey_creation_mode"), nullable=False)
    status = Column(Enum(JourneyStatus, name="journey_status"), nullable=False, default=JourneyStatus.draft)
    validation_score = Column(Float, nullable=True)
    tracking_enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String(128), nullable=True)

    target_group = relationship("TargetGroup", back_populates="journeys")
    phases = relationship("JourneyPhase", back_populates="journey", cascade="all, delete-orphan")


class JourneyPhase(Base):
    __tablename__ = "journey_phases"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    journey_id = Column(UUID(as_uuid=True), ForeignKey("audion.journeys.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    phase_order = Column(Integer, nullable=False)
    expected_duration_min = Column(Integer, nullable=True)
    expected_duration_max = Column(Integer, nullable=True)
    duration_unit = Column(String(32), nullable=True, default="minutes")
    expected_emotion = Column(Text, nullable=True)
    emotion_intensity = Column(Float, nullable=True)
    url_pattern = Column(JSONB, nullable=True)
    form_id = Column(JSONB, nullable=True)
    event_names = Column(JSONB, nullable=True)
    validation_status = Column(String(64), nullable=True)
    validation_score = Column(Float, nullable=True)
    generated_by_ai = Column(Boolean, nullable=False, default=False)
    generation_confidence = Column(Float, nullable=True)
    source_chunks = Column(JSONB, nullable=True)

    journey = relationship("Journey", back_populates="phases")
    elements = relationship("JourneyPhaseElement", back_populates="phase", cascade="all, delete-orphan")
    expectations = relationship("JourneyExpectation", back_populates="phase", cascade="all, delete-orphan")


class JourneyPhaseElement(Base):
    __tablename__ = "journey_phase_elements"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    phase_id = Column(UUID(as_uuid=True), ForeignKey("audion.journey_phases.id", ondelete="CASCADE"), nullable=False)
    element_type = Column(Enum(JourneyElementType, name="journey_element_type"), nullable=False)
    content = Column(Text, nullable=False)
    element_order = Column(Integer, nullable=False)
    element_metadata = Column("metadata", JSONB, nullable=True)
    source_type = Column(String(64), nullable=True)
    source_chunk_ids = Column(JSONB, nullable=True)
    confidence = Column(Float, nullable=True)

    phase = relationship("JourneyPhase", back_populates="elements")


class JourneyExpectation(Base):
    __tablename__ = "journey_expectations"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    phase_id = Column(UUID(as_uuid=True), ForeignKey("audion.journey_phases.id", ondelete="CASCADE"), nullable=False)
    metric_type = Column(Enum(JourneyMetricType, name="journey_metric_type"), nullable=False)
    metric_name = Column(String(128), nullable=False)
    expected_value = Column(Float, nullable=True)
    expected_value_max = Column(Float, nullable=True)
    unit = Column(String(32), nullable=True)
    comparison = Column(Enum(JourneyComparisonOperator, name="journey_comparison_operator"), nullable=False)
    warning_threshold_percent = Column(Float, nullable=True)
    critical_threshold_percent = Column(Float, nullable=True)
    hypothesis = Column(Text, nullable=True)
    based_on_persona_id = Column(UUID(as_uuid=True), ForeignKey("audion.personas.id", ondelete="SET NULL"), nullable=True)
    data_source = Column(String(64), nullable=False)
    data_source_config = Column(JSONB, nullable=True)

    phase = relationship("JourneyPhase", back_populates="expectations")
    persona = relationship("Persona")
    measurements = relationship("JourneyMeasurement", back_populates="expectation", cascade="all, delete-orphan")


class JourneyMeasurement(Base):
    __tablename__ = "journey_measurements"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    expectation_id = Column(UUID(as_uuid=True), ForeignKey("audion.journey_expectations.id", ondelete="CASCADE"), nullable=False)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    actual_value = Column(Float, nullable=False)
    delta_absolute = Column(Float, nullable=True)
    delta_percent = Column(Float, nullable=True)
    status = Column(Enum(JourneyMeasurementStatus, name="journey_measurement_status"), nullable=False)
    sample_size = Column(Integer, nullable=True)
    data_source = Column(String(64), nullable=False)
    raw_data = Column(JSONB, nullable=True)
    synced_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    expectation = relationship("JourneyExpectation", back_populates="measurements")


class JourneyInsight(Base):
    __tablename__ = "journey_insights"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    journey_id = Column(UUID(as_uuid=True), ForeignKey("audion.journeys.id", ondelete="CASCADE"), nullable=False)
    phase_id = Column(UUID(as_uuid=True), ForeignKey("audion.journey_phases.id", ondelete="SET NULL"), nullable=True)
    expectation_id = Column(UUID(as_uuid=True), ForeignKey("audion.journey_expectations.id", ondelete="SET NULL"), nullable=True)
    insight_type = Column(Enum(JourneyInsightType, name="journey_insight_type"), nullable=False)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    ai_analysis = Column(JSONB, nullable=True)
    ai_recommendations = Column(JSONB, nullable=True)
    evidence = Column(JSONB, nullable=True)
    confidence = Column(Float, nullable=True)
    priority = Column(Float, nullable=True)
    status = Column(Enum(JourneyInsightStatus, name="journey_insight_status"), nullable=False, default=JourneyInsightStatus.new)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    journey = relationship("Journey")
    phase = relationship("JourneyPhase")
    expectation = relationship("JourneyExpectation")


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(128), unique=True, nullable=False)
    template = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    input_variables = Column(JSONB, nullable=False, default=[])
    version = Column(String(32), nullable=False, default="1.0")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class ProjectResearchRunStatus(PyEnum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class ProjectResearchRun(Base):
    __tablename__ = "project_research_runs"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("audion.projects.id", ondelete="CASCADE"), nullable=False)
    requested_by_user_id = Column(UUID(as_uuid=True), ForeignKey("audion.users.id", ondelete="SET NULL"), nullable=True)
    status = Column(
        Enum(ProjectResearchRunStatus, name="project_research_run_status"),
        nullable=False,
        default=ProjectResearchRunStatus.queued,
    )
    seed_url = Column(Text, nullable=False)
    crawl_limits = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project")
    requested_by = relationship("User")
    sources = relationship("ProjectResearchSource", back_populates="run", cascade="all, delete-orphan")
    summaries = relationship("ProjectResearchSummary", back_populates="run", cascade="all, delete-orphan")


class ProjectResearchSource(Base):
    __tablename__ = "project_research_sources"
    __table_args__ = (
        UniqueConstraint("run_id", "url", name="uq_project_research_source_run_url"),
        {"schema": "audion"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("audion.project_research_runs.id", ondelete="CASCADE"), nullable=False)
    url = Column(Text, nullable=False)
    title = Column(Text, nullable=True)
    content_type = Column(String(128), nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    content_hash = Column(String(64), nullable=True)
    text_excerpt = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=True)
    meta = Column(JSONB, nullable=True)

    run = relationship("ProjectResearchRun", back_populates="sources")


class ProjectResearchSummary(Base):
    __tablename__ = "project_research_summaries"
    __table_args__ = (
        UniqueConstraint("run_id", name="uq_project_research_summary_run"),
        {"schema": "audion"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("audion.project_research_runs.id", ondelete="CASCADE"), nullable=False)
    summary_en = Column(JSONB, nullable=False)
    summary_de = Column(JSONB, nullable=True)
    citations = Column(JSONB, nullable=True)
    model = Column(String(128), nullable=True)
    usage = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    run = relationship("ProjectResearchRun", back_populates="summaries")


class ProjectResearchEvent(Base):
    __tablename__ = "project_research_events"
    __table_args__ = {"schema": "audion"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("audion.project_research_runs.id", ondelete="CASCADE"), nullable=False)
    seq = Column(BigInteger, nullable=False)
    event_type = Column(String(64), nullable=False)
    message = Column(Text, nullable=True)
    payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    run = relationship("ProjectResearchRun")

