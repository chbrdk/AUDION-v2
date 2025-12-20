from __future__ import annotations

import os
from datetime import datetime
from io import BytesIO
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from msqdx_glass_proto import PersonaProfile

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_persona_service.db")
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
os.environ.setdefault("PERSONA_CONSOLE_BASE_URL", "http://localhost:3000")
os.environ.setdefault("PERSONA_MEDIA_BASE_PATH", "/personas")
os.environ.setdefault("PERSONA_CACHE_TTL_SECONDS", "30")
os.environ.setdefault("PERSONA_BACKEND_PUBLIC_URL", "http://localhost:8000")

from app.models import (
    Base,
    Document,
    Persona,
    PersonaAuditLog,
    PersonaKnowledgeEntry,
    PersonaPrompt as PersonaPromptModel,
    PersonaSource,
    PersonaStatus,
)
from app.schemas import PersonaPatchRequest
from app.services.persona_store import PersonaInsight, PersonaService


def build_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


class StubRedis:
    def __init__(self) -> None:
        self.store: dict[str, bytes] = {}

    def get(self, key: str) -> bytes | None:
        return self.store.get(key)

    def setex(self, key: str, ttl: int, value: bytes) -> None:  # noqa: ARG002
        self.store[key] = value

    def delete(self, key: str) -> None:
        self.store.pop(key, None)


class StubInsights:
    def build(self, *, persona: Persona, sources: list[PersonaSource]) -> PersonaInsight:  # noqa: ARG002
        return PersonaInsight(relatedChunkIds=[str(source.chunk_id) for source in sources], graphRelationships=[])


class StubStorage:
    def generate_presigned_url(self, *, key: str, expires_in: int = 3600) -> str:  # noqa: ARG002
        return f"https://mock-storage/{key}"

    def stream(self, *, key: str):  # noqa: ARG002
        return BytesIO(b"mock"), "application/octet-stream"


def create_service() -> PersonaService:
    service = PersonaService(redis_client=StubRedis(), insights_builder=StubInsights())
    service._storage = StubStorage()  # type: ignore[attr-defined]  # override S3 client for tests
    return service


def test_get_persona_includes_documents_and_knowledge():
    session = build_session()
    service = create_service()

    persona = Persona(
        project_id=uuid4(),
        name="Data Dana",
        segment="mobility",
        headline="E-Bike Enthusiast",
        profile={},
        confidence=0.77,
        version="1.0.0",
        status=PersonaStatus.published,
        image_url="personas/avatar.png",
    )
    session.add(persona)
    session.flush()

    doc = Document(
        filename="study.pdf",
        content_type="application/pdf",
        size_bytes=1024,
        status="completed",
        object_key="personas/docs/study.pdf",
        file_path="personas/docs/study.pdf",
        persona_id=persona.id,
        uploaded_by="qa",
    )
    knowledge = PersonaKnowledgeEntry(
        persona_id=persona.id,
        title="Interview Summary",
        content="Prefers step-through frames.",
        metadata={"source": "customer_call"},
        created_by="qa",
    )
    session.add_all(
        [
            doc,
            knowledge,
            PersonaSource(persona_id=persona.id, chunk_id=uuid4(), confidence=0.5, rationale="seed"),
            PersonaPromptModel(persona_id=persona.id, system_prompt="be helpful", template_version="v1"),
        ]
    )
    session.commit()

    response = service.get_persona(session, str(persona.id), use_cache=False)

    assert response.documents[0].filename == "study.pdf"
    expected_download = f"http://localhost:8000/personas/{persona.id}/documents/{doc.id}/download"
    assert response.documents[0].downloadUrl == expected_download
    assert response.knowledge[0].title == "Interview Summary"
    assert response.metadata.avatarUrl == f"http://localhost:8000/personas/{persona.id}/avatar"


def test_list_personas_returns_summary_with_avatar():
    session = build_session()
    service = create_service()

    persona = Persona(
        project_id=uuid4(),
        name="Erik Example",
        segment="enterprise",
        headline="CFO skeptic",
        profile={},
        confidence=0.8,
        version="1.0.0",
        status=PersonaStatus.draft,
        image_url="personas/example.png",
    )
    session.add(persona)
    session.commit()

    response = service.list_personas(session, project_id=str(persona.project_id))

    assert response.total == 1
    assert response.items[0].name == "Erik Example"
    assert response.items[0].avatarUrl == f"http://localhost:8000/personas/{persona.id}/avatar"


def test_avatar_url_uses_https_when_provided():
    session = build_session()
    service = create_service()

    persona = Persona(
        project_id=uuid4(),
        name="External Avatar",
        segment="design",
        headline="Uses CDN",
        profile={},
        confidence=0.9,
        version="1.0.0",
        status=PersonaStatus.published,
        image_url="https://cdn.example.com/avatar.png",
    )
    session.add(persona)
    session.commit()

    response = service.get_persona(session, str(persona.id), use_cache=False)

    assert response.metadata.avatarUrl == "https://cdn.example.com/avatar.png"


def test_update_persona_records_audit_and_clears_cache():
    session = build_session()
    service = create_service()
    persona = Persona(
        project_id=uuid4(),
        name="Draft Persona",
        segment="ops",
        headline="Ops Lead",
        profile={},
        confidence=0.6,
        version="0.1.0",
        status=PersonaStatus.draft,
    )
    session.add(persona)
    session.commit()

    patch = PersonaPatchRequest(
        headline="Ops Lead Updated",
        confidence=0.75,
        status="published",
        updated_by="qa@test",
        profile=PersonaProfile(
            id=str(persona.id),
            name="Draft Persona",
            segment="ops",
            headline="Ops Lead Updated",
            bio="",
            traits={},
            pain_points=[],
            goals=[],
            communication_style={
                "vocabulary": [],
                "sentence_structure": "",
                "skepticism_level": 0,
            },
            confidence=0.75,
            version="0.2.0",
            created_at=datetime.utcnow().isoformat(),
        ),
    )

    response = service.update_persona(session, str(persona.id), patch)

    assert response.metadata.status == "published"
    audits = session.query(PersonaAuditLog).filter(PersonaAuditLog.persona_id == persona.id).all()
    assert len(audits) == 1
    assert audits[0].payload_after["status"] == "published"
