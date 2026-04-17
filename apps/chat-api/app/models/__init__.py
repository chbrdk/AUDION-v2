"""
Models for Chat API.
All tables are in the audion schema in STORION database.
"""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from ..db import Base


# Schema prefix for STORION database
_SCHEMA_PREFIX = "audion"


def _get_table_args():
    """Get table args with schema."""
    if _SCHEMA_PREFIX:
        return {"schema": _SCHEMA_PREFIX}
    return {}


def _fk(table_column: str, **kwargs):
    """Create ForeignKey with schema prefix if using STORION DB."""
    if _SCHEMA_PREFIX:
        return ForeignKey(f"{_SCHEMA_PREFIX}.{table_column}", **kwargs)
    return ForeignKey(table_column, **kwargs)


# DocumentChunk model - shared with indexing-api (same database)
class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = _get_table_args()

    id = Column(UUID(as_uuid=True), primary_key=True)
    document_id = Column(UUID(as_uuid=True), _fk("documents.id"), nullable=False)
    content = Column(Text, nullable=False)
    chunk_metadata = Column(JSON, nullable=False)


class Persona(Base):
    __tablename__ = "personas"
    __table_args__ = _get_table_args()

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(128), nullable=False)
    segment = Column(String(128), nullable=False)
    # English (canonical) headline; DB uses TEXT in shared STORION schema.
    headline = Column(Text, nullable=False)
    headline_de = Column(Text, nullable=True)
    profile = Column(JSON, nullable=False)
    profile_de = Column(JSONB, nullable=True)
    profile_card = Column(JSONB, nullable=True)
    profile_card_de = Column(JSONB, nullable=True)
    confidence = Column(Float, nullable=False)
    version = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    image_url = Column(Text, nullable=True)
    image_generated_at = Column(DateTime, nullable=True)

    prompt = relationship("PersonaPrompt", uselist=False, back_populates="persona")
    sources = relationship("PersonaSource", back_populates="persona")


class PersonaPrompt(Base):
    __tablename__ = "persona_prompts"
    __table_args__ = _get_table_args()

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), _fk("personas.id"), nullable=False)
    system_prompt = Column(Text, nullable=False)
    system_prompt_de = Column(Text, nullable=True)
    template_version = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    template_metadata = Column(JSONB, nullable=True)

    persona = relationship("Persona", back_populates="prompt")


class PersonaSource(Base):
    __tablename__ = "persona_sources"
    __table_args__ = _get_table_args()

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), _fk("personas.id"), nullable=False)
    chunk_id = Column(UUID(as_uuid=True), nullable=False)  # Reference to document_chunks.id (table in indexing-api)
    confidence = Column(Float, nullable=False)
    rationale = Column(Text, nullable=True)

    persona = relationship("Persona", back_populates="sources")


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"
    __table_args__ = _get_table_args()

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(128), unique=True, nullable=False)
    template = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    input_variables = Column(JSONB, nullable=False, default=[])
    version = Column(String(32), nullable=False, default="1.0")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

