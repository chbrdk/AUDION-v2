from __future__ import annotations

import os
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_target_group.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("S3_ENDPOINT", "http://localhost:9000")
os.environ.setdefault("S3_ACCESS_KEY", "test")
os.environ.setdefault("S3_SECRET_KEY", "test")
os.environ.setdefault("S3_BUCKET", "test-bucket")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "test")
os.environ.setdefault("CLAUDE_API_KEY", "test-key")

from app.models import (
    Base,
    DocumentChunk,
    Persona,
    TargetGroup,
    TargetGroupKnowledgeEntry,
    TargetGroupSource,
)


def build_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def test_target_group_defaults_include_timestamps():
    session = build_session()
    target_group = TargetGroup(
        project_id=uuid4(),
        name="Enterprise Buyers",
        segment="enterprise",
        description="Enterprise customers",
    )
    session.add(target_group)
    session.commit()

    assert target_group.created_at is not None
    assert target_group.updated_at is not None
    assert target_group.updated_by is None


def test_target_group_persona_relationship():
    session = build_session()
    project_id = uuid4()
    
    target_group = TargetGroup(
        project_id=project_id,
        name="Enterprise Buyers",
        segment="enterprise",
    )
    session.add(target_group)
    session.commit()
    
    persona = Persona(
        project_id=project_id,
        name="Erik Example",
        segment="enterprise",
        headline="CFO",
        profile={"bio": "Sample"},
        confidence=0.9,
        version="1.0.0",
        target_group_id=target_group.id,
    )
    session.add(persona)
    session.commit()
    
    session.refresh(target_group)
    assert len(target_group.personas) == 1
    assert target_group.personas[0].id == persona.id


def test_target_group_source_relationship():
    session = build_session()
    target_group = TargetGroup(
        project_id=uuid4(),
        name="Enterprise Buyers",
        segment="enterprise",
    )
    session.add(target_group)
    session.commit()
    
    # Create a document chunk
    from app.models import Document
    document = Document(
        filename="test.pdf",
        file_path="/test.pdf",
        content_type="application/pdf",
        size_bytes=1000,
        status="completed",
    )
    session.add(document)
    session.commit()
    
    chunk = DocumentChunk(
        document_id=document.id,
        content="Test content",
        chunk_metadata={"order": 0},
    )
    session.add(chunk)
    session.commit()
    
    source = TargetGroupSource(
        target_group_id=target_group.id,
        chunk_id=chunk.id,
        relevance_score=0.95,
        rationale="High relevance",
    )
    session.add(source)
    session.commit()
    
    session.refresh(target_group)
    assert len(target_group.sources) == 1
    assert target_group.sources[0].relevance_score == 0.95


def test_target_group_knowledge_entry_relationship():
    session = build_session()
    target_group = TargetGroup(
        project_id=uuid4(),
        name="Enterprise Buyers",
        segment="enterprise",
    )
    session.add(target_group)
    session.commit()
    
    knowledge_entry = TargetGroupKnowledgeEntry(
        target_group_id=target_group.id,
        title="Pricing concerns",
        content="Enterprise buyers are price-sensitive",
        created_by="system",
    )
    session.add(knowledge_entry)
    session.commit()
    
    session.refresh(target_group)
    assert len(target_group.knowledge_entries) == 1
    assert target_group.knowledge_entries[0].title == "Pricing concerns"


def test_persona_target_group_relationship():
    session = build_session()
    project_id = uuid4()
    
    target_group = TargetGroup(
        project_id=project_id,
        name="Enterprise Buyers",
        segment="enterprise",
    )
    session.add(target_group)
    session.commit()
    
    persona = Persona(
        project_id=project_id,
        name="Erik Example",
        segment="enterprise",
        headline="CFO",
        profile={"bio": "Sample"},
        confidence=0.9,
        version="1.0.0",
        target_group_id=target_group.id,
    )
    session.add(persona)
    session.commit()
    
    session.refresh(persona)
    assert persona.target_group is not None
    assert persona.target_group.id == target_group.id


