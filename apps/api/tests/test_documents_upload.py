from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path
from typing import Iterator

import pytest
from fastapi import UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_documents_upload.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "test")

from app.models import Base, ProcessingJob
from app.routers import documents


@pytest.fixture()
def session() -> Iterator[Session]:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.mark.asyncio
async def test_upload_document_persists_file_under_data_dir(tmp_path: Path, session: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    os.environ["DATA_DIR"] = str(tmp_path)

    captured: dict[str, str] = {}

    def fake_enqueue(document_id: str, file_path: str) -> None:
        captured["document_id"] = document_id
        captured["file_path"] = file_path

    monkeypatch.setattr(documents, "enqueue_ingestion", fake_enqueue)
    monkeypatch.setattr(documents, "storage", documents.StorageService())  # type: ignore[attr-defined]

    payload = b"%PDF-1.4 mock content"
    upload = UploadFile(filename="insights.pdf", file=BytesIO(payload))
    upload.headers = {"content-type": "application/pdf"}  # type: ignore[attr-defined]
    upload.size = len(payload)  # type: ignore[attr-defined]

    response = await documents.upload_document(file=upload, session=session)

    assert "document_id" in captured
    persisted_path = Path(captured["file_path"])
    assert persisted_path.exists()
    assert persisted_path.read_bytes() == payload

    job = session.query(ProcessingJob).one()
    assert str(job.id) == response.job_id
    assert job.status == "pending"

