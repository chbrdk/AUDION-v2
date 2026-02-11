from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator
from uuid import UUID, uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_ingestion_service.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "test")

from app import db  # noqa: E402
from app.models import Document, DocumentChunk, Persona, ProcessingJob  # noqa: E402
from app.services import ingestion  # noqa: E402


@pytest.fixture()
def session(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Session]:
    engine = create_engine(f"sqlite:///{tmp_path}/ingestion.db")
    db.Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(db, "engine", engine)
    monkeypatch.setattr(db, "SessionLocal", SessionLocal)
    db.Base.metadata.create_all(engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


class StubChunk:
    def __init__(self, text: str) -> None:
        self.text = text


class StubEmbedder:
    def encode(self, texts, batch_size=8):  # noqa: D401
        return {"dense_vecs": [[float(idx)] for idx, _ in enumerate(texts)]}


class StubQdrant:
    def __init__(self) -> None:
        self._created = False
        self.points = []

    def collection_exists(self, name: str) -> bool:
        return self._created

    def create_collection(self, **kwargs) -> None:  # noqa: D401
        self._created = True

    def upsert(self, *, collection_name: str, points):  # noqa: D401
        self.points.extend(points)


def test_ingestion_creates_chunks_and_updates_status(tmp_path: Path, session: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    os.environ["DATA_DIR"] = str(tmp_path)
    document_id = uuid4()
    # persona_id = uuid4()

    persona = Persona(
        project_id=uuid4(),
        name="Hardening",
        segment="test",
        headline="Testing ingestion",
        profile={},
        confidence=0.5,
        version="1.0.0",
        status="published",
    )
    session.add(persona)
    session.flush()

    session.add_all(
        [
            Document(id=document_id, filename="doc.txt", content_type="text/plain", size_bytes=12, status="processing", file_path="doc.txt", persona_id=persona.id),
            ProcessingJob(document_id=document_id, status="pending", progress=0),
        ]
    )
    session.commit()

    file_path = tmp_path / "doc.txt"
    file_path.write_text("chunk one\nchunk two")

    stub_qdrant = StubQdrant()
    service = ingestion.IngestionService(embedder=StubEmbedder(), qdrant=stub_qdrant)
    monkeypatch.setattr(ingestion, "partition", lambda filename: [StubChunk("chunk one"), StubChunk("chunk two")])

    service.ingest(document_id=UUID(str(document_id)), file_path=file_path)

    with db.get_session() as verify:
        job = verify.query(ProcessingJob).filter(ProcessingJob.document_id == document_id).one()
        document = verify.query(Document).get(document_id)
        chunks = verify.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).all()
    assert job.status == "completed"
    assert job.progress == 100
    assert document.status == "completed"
    assert len(chunks) == 2
    assert stub_qdrant.points


def test_ingestion_handles_empty_partition(tmp_path: Path, session: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    os.environ["DATA_DIR"] = str(tmp_path)
    document_id = uuid4()
    session.add_all(
        [
            Document(id=document_id, filename="empty.txt", content_type="text/plain", size_bytes=0, status="processing", file_path="empty.txt"),
            ProcessingJob(document_id=document_id, status="pending", progress=0),
        ]
    )
    session.commit()
    file_path = tmp_path / "empty.txt"
    file_path.write_text("")

    service = ingestion.IngestionService(embedder=StubEmbedder(), qdrant=StubQdrant())
    monkeypatch.setattr(ingestion, "partition", lambda filename: [StubChunk(""), StubChunk("   ")])

    service.ingest(document_id=UUID(str(document_id)), file_path=file_path)

    with db.get_session() as verify:
        job = verify.query(ProcessingJob).filter(ProcessingJob.document_id == document_id).one()
        document = verify.query(Document).get(document_id)
        chunks = verify.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).all()
    assert job.status == "completed"
    assert job.progress == 100
    assert document.status == "completed"
    assert chunks == []

