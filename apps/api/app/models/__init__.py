from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional
from uuid import uuid4

from sqlalchemy import JSON, Column, DateTime, Enum, Float, ForeignKey, String, Text
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
    deleted = "deleted"


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    filename = Column(String(512), nullable=False)
    file_path = Column(String(1024), nullable=False)
    content_type = Column(String(128), nullable=False)
    size_bytes = Column(Float, nullable=False)
    status = Column(Enum("processing", "completed", "failed", name="document_status"), nullable=False)
    object_key = Column(String(512), nullable=True)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("personas.id", ondelete="SET NULL"), nullable=True)
    target_group_id = Column(UUID(as_uuid=True), ForeignKey("target_groups.id", ondelete="SET NULL"), nullable=True)
    uploaded_by = Column(String(128), nullable=True)
    insight_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    chunks = relationship("DocumentChunk", back_populates="document")
    persona = relationship("Persona", back_populates="documents")
    target_group = relationship("TargetGroup", back_populates="documents")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    knowledge_entry_id = Column(UUID(as_uuid=True), ForeignKey("target_group_knowledge_entries.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=False)
    chunk_metadata = Column("chunk_metadata", JSON, nullable=False)

    document = relationship("Document", back_populates="chunks")
    knowledge_entry = relationship("TargetGroupKnowledgeEntry", back_populates="chunks")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    segment = Column(String(128), nullable=False)
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(128), nullable=False)
    segment = Column(String(128), nullable=False)
    headline = Column(String(256), nullable=False)
    profile = Column(JSON, nullable=False)
    confidence = Column(Float, nullable=False)
    version = Column(String(32), nullable=False)
    target_group_id = Column(UUID(as_uuid=True), ForeignKey("target_groups.id", ondelete="SET NULL"), nullable=True)
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
    image_url = Column(String(512), nullable=True)
    image_generated_at = Column(DateTime, nullable=True)
    profile_card = Column(JSONB, nullable=True)

    target_group = relationship("TargetGroup", back_populates="personas")
    prompt = relationship("PersonaPrompt", uselist=False, back_populates="persona")
    sources = relationship("PersonaSource", back_populates="persona")
    audit_logs = relationship("PersonaAuditLog", back_populates="persona", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="persona")


class PersonaPrompt(Base):
    __tablename__ = "persona_prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("personas.id"), nullable=False)
    system_prompt = Column(Text, nullable=False)
    template_version = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    persona = relationship("Persona", back_populates="prompt")


class PersonaSource(Base):
    __tablename__ = "persona_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("personas.id"), nullable=False)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey("document_chunks.id"), nullable=False)
    confidence = Column(Float, nullable=False)
    rationale = Column(Text, nullable=True)

    persona = relationship("Persona", back_populates="sources")


class PersonaAuditLog(Base):
    __tablename__ = "persona_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("personas.id"), nullable=False)
    action = Column(Enum(PersonaAuditAction, name="persona_audit_action"), nullable=False)
    actor = Column(String(128), nullable=False)
    payload_before = Column(JSON, nullable=True)
    payload_after = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    persona = relationship("Persona", back_populates="audit_logs")


class PersonaKnowledgeEntry(Base):
    __tablename__ = "persona_knowledge_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(256), nullable=False)
    content = Column(Text, nullable=False)
    metadata_payload = Column("metadata", JSON, nullable=True)
    created_by = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TargetGroupSource(Base):
    __tablename__ = "target_group_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    target_group_id = Column(UUID(as_uuid=True), ForeignKey("target_groups.id", ondelete="CASCADE"), nullable=False)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey("document_chunks.id"), nullable=False)
    relevance_score = Column(Float, nullable=False, default=1.0)
    rationale = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    target_group = relationship("TargetGroup", back_populates="sources")


class TargetGroupKnowledgeEntry(Base):
    __tablename__ = "target_group_knowledge_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    target_group_id = Column(UUID(as_uuid=True), ForeignKey("target_groups.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(256), nullable=False)
    content = Column(Text, nullable=False)
    metadata_payload = Column("metadata", JSON, nullable=True)
    created_by = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    target_group = relationship("TargetGroup", back_populates="knowledge_entries")
    chunks = relationship("DocumentChunk", back_populates="knowledge_entry", cascade="all, delete-orphan")


# Import Journey models
from .journey import (
    Journey,
    JourneyPhase,
    JourneyPhaseElement,
    JourneyExpectation,
    JourneyMeasurement,
    JourneyInsight,
    JourneyChange,
    JourneyCreationMode,
    JourneyStatus,
    JourneyElementType,
    JourneyMetricType,
    JourneyComparisonOperator,
    JourneyMeasurementStatus,
    JourneyInsightType,
    JourneyInsightStatus,
)

