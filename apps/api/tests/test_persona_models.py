from __future__ import annotations

import os
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_persona.db")
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

from app.models import Base, Persona, PersonaAuditAction, PersonaAuditLog, PersonaStatus


def build_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def test_persona_defaults_include_status_and_timestamps():
    session = build_session()
    persona = Persona(
        project_id=uuid4(),
        name="Erika Example",
        segment="enterprise",
        headline="CFO with ROI focus",
        profile={"bio": "Sample"},
        confidence=0.9,
        version="1.0.0",
    )
    session.add(persona)
    session.commit()

    assert persona.status == PersonaStatus.draft
    assert persona.updated_at is not None
    assert persona.updated_by is None


def test_persona_audit_log_relationship_persists_payload_snapshots():
    session = build_session()
    persona = Persona(
        project_id=uuid4(),
        name="Nora Navigator",
        segment="startup",
        headline="Founder persona",
        profile={"bio": "Explores features"},
        confidence=0.85,
        version="1.0.0",
    )
    session.add(persona)
    session.commit()

    audit_log = PersonaAuditLog(
        persona_id=persona.id,
        action=PersonaAuditAction.updated,
        actor="system@tests",
        payload_before={"headline": "Founder persona"},
        payload_after={"headline": "Founder persona v2"},
    )
    session.add(audit_log)
    session.commit()
    session.refresh(persona)

    assert len(persona.audit_logs) == 1
    assert persona.audit_logs[0].action == PersonaAuditAction.updated

