from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from ..db import Base


# DocumentChunk model - shared with indexing-api (same database)
class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    content = Column(Text, nullable=False)
    chunk_metadata = Column(JSON, nullable=False)


class Persona(Base):
    __tablename__ = "personas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(128), nullable=False)
    segment = Column(String(128), nullable=False)
    headline = Column(String(256), nullable=False)
    profile = Column(JSON, nullable=False)
    profile_card = Column(JSONB, nullable=True)
    confidence = Column(Float, nullable=False)
    version = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    image_url = Column(Text, nullable=True)
    image_generated_at = Column(DateTime, nullable=True)

    prompt = relationship("PersonaPrompt", uselist=False, back_populates="persona")
    sources = relationship("PersonaSource", back_populates="persona")


class PersonaPrompt(Base):
    __tablename__ = "persona_prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("personas.id"), nullable=False)
    system_prompt = Column(Text, nullable=False)
    template_version = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    template_metadata = Column(JSONB, nullable=True)

    persona = relationship("Persona", back_populates="prompt")


class PersonaSource(Base):
    __tablename__ = "persona_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("personas.id"), nullable=False)
    chunk_id = Column(UUID(as_uuid=True), nullable=False)  # Reference to document_chunks.id (table in indexing-api)
    confidence = Column(Float, nullable=False)
    rationale = Column(Text, nullable=True)

    persona = relationship("Persona", back_populates="sources")

