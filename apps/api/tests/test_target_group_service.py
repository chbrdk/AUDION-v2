from __future__ import annotations

import os
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_target_group_service.db")
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

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import Base, Persona, Project, TargetGroup, TargetGroupKnowledgeEntry
from app.schemas import TargetGroupCreateRequest, TargetGroupUpdateRequest
from app.services.target_group_store import TargetGroupService


def build_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def seed_project(session: Session, project_id) -> None:
    session.add(Project(id=project_id, name="Test Project"))
    session.commit()


def test_list_target_groups():
    service = TargetGroupService()
    session = build_session()
    project_id = uuid4()
    
    # Create target groups
    tg1 = TargetGroup(
        project_id=project_id,
        name="Enterprise Buyers",
        segment="enterprise",
    )
    tg2 = TargetGroup(
        project_id=project_id,
        name="Startup Founders",
        segment="startup",
    )
    session.add(tg1)
    session.add(tg2)
    session.commit()
    
    result = service.list_target_groups(session, project_id=str(project_id))
    
    assert result.total == 2
    assert len(result.items) == 2
    assert result.items[0].name in ["Enterprise Buyers", "Startup Founders"]


def test_create_target_group():
    service = TargetGroupService()
    session = build_session()
    project_id = uuid4()
    seed_project(session, project_id)
    
    payload = TargetGroupCreateRequest(
        project_id=str(project_id),
        name="Enterprise Buyers",
        segment="enterprise",
        description="Enterprise customers",
    )
    
    result = service.create_target_group(session, payload)
    
    assert result.name == "Enterprise Buyers"
    assert result.segment == "enterprise"
    assert result.description == "Enterprise customers"
    assert result.project_id == str(project_id)


def test_create_target_group_requires_existing_project():
    service = TargetGroupService()
    session = build_session()
    project_id = uuid4()
    payload = TargetGroupCreateRequest(
        project_id=str(project_id),
        name="Enterprise Buyers",
        segment="enterprise",
    )
    try:
        service.create_target_group(session, payload)
        assert False, "expected project_not_found"
    except ValueError as exc:
        assert str(exc) == "project_not_found"


def test_get_target_group_with_personas_and_knowledge():
    service = TargetGroupService()
    session = build_session()
    project_id = uuid4()
    
    # Create target group
    tg = TargetGroup(
        project_id=project_id,
        name="Enterprise Buyers",
        segment="enterprise",
    )
    session.add(tg)
    session.commit()
    
    # Create persona
    persona = Persona(
        project_id=project_id,
        name="Erik Example",
        segment="enterprise",
        headline="CFO",
        profile={"bio": "Sample"},
        confidence=0.9,
        version="1.0.0",
        target_group_id=tg.id,
    )
    session.add(persona)
    
    # Create knowledge entry
    knowledge = TargetGroupKnowledgeEntry(
        target_group_id=tg.id,
        title="Pricing concerns",
        content="Enterprise buyers are price-sensitive",
        created_by="system",
    )
    session.add(knowledge)
    session.commit()
    
    result = service.get_target_group(session, str(tg.id))
    
    assert result.name == "Enterprise Buyers"
    assert len(result.personas) == 1
    assert result.personas[0].name == "Erik Example"
    assert len(result.knowledge_entries) == 1
    assert result.knowledge_entries[0].title == "Pricing concerns"


def test_update_target_group():
    service = TargetGroupService()
    session = build_session()
    project_id = uuid4()
    
    tg = TargetGroup(
        project_id=project_id,
        name="Enterprise Buyers",
        segment="enterprise",
    )
    session.add(tg)
    session.commit()
    
    payload = TargetGroupUpdateRequest(
        name="Enterprise Customers",
        description="Updated description",
        updated_by="admin",
    )
    
    result = service.update_target_group(session, str(tg.id), payload)
    
    assert result.name == "Enterprise Customers"
    assert result.description == "Updated description"


def test_list_knowledge():
    service = TargetGroupService()
    session = build_session()
    project_id = uuid4()
    
    tg = TargetGroup(
        project_id=project_id,
        name="Enterprise Buyers",
        segment="enterprise",
    )
    session.add(tg)
    session.commit()
    
    knowledge1 = TargetGroupKnowledgeEntry(
        target_group_id=tg.id,
        title="Pricing concerns",
        content="Content 1",
        created_by="system",
    )
    knowledge2 = TargetGroupKnowledgeEntry(
        target_group_id=tg.id,
        title="Integration issues",
        content="Content 2",
        created_by="system",
    )
    session.add(knowledge1)
    session.add(knowledge2)
    session.commit()
    
    result = service.list_knowledge(session, str(tg.id))
    
    assert len(result) == 2
    assert result[0].title in ["Pricing concerns", "Integration issues"]


