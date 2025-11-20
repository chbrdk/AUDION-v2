from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Iterable
from uuid import UUID

import structlog
from FlagEmbedding import BGEM3FlagModel
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from unstructured.partition.auto import partition

from ..core.config import get_settings
from ..db import get_session
from ..models import Document, DocumentChunk, ProcessingJob

logger = structlog.get_logger(__name__)
settings = get_settings()


class IngestionService:
    def __init__(self) -> None:
        self._embedder = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
        self._qdrant = QdrantClient(settings.qdrant_url)
        self._collection = "research_chunks"

    def _ensure_collection(self) -> None:
        if not self._qdrant.collection_exists(self._collection):
            self._qdrant.create_collection(
                collection_name=self._collection,
                vectors_configs=qmodels.VectorParams(size=1024, distance=qmodels.Distance.COSINE),
            )

    def ingest(self, *, document_id: UUID, file_path: Path) -> None:
        self._ensure_collection()
        logger.info("ingest.start", document_id=str(document_id))

        with get_session() as session:
            job: ProcessingJob | None = (
                session.query(ProcessingJob).filter(ProcessingJob.document_id == document_id).one()
            )
            if not job:
                raise RuntimeError("Processing job missing")
            job.status = "processing"
            job.progress = 5
            session.commit()

        elements = partition(filename=str(file_path))
        cleaned_chunks = [chunk.text.strip() for chunk in elements if chunk.text]

        embeddings = self._embedder.encode(cleaned_chunks, batch_size=8)["dense_vecs"]
        points = []
        for idx, (text, vector) in enumerate(zip(cleaned_chunks, embeddings, strict=True)):
            chunk = DocumentChunk(
                document_id=document_id,
                content=text,
                chunk_metadata={"order": idx, "length": len(text)},
            )
            with get_session() as session:
                session.add(chunk)
                session.commit()

            points.append(
                qmodels.PointStruct(
                    id=f"{document_id}-{idx}",
                    vector=vector,
                    payload={
                        "document_id": str(document_id),
                        "chunk_id": str(chunk.id),
                        "content": text,
                        "order": idx,
                    },
                )
            )

        self._qdrant.upsert(collection_name=self._collection, points=points)

        with get_session() as session:
            job = (
                session.query(ProcessingJob).filter(ProcessingJob.document_id == document_id).one()
            )
            job.status = "completed"
            job.progress = 100
            job.updated_at = datetime.utcnow()
            document = session.query(Document).get(document_id)
            if document:
                document.status = "completed"
                document.updated_at = datetime.utcnow()
            session.commit()

        logger.info("ingest.completed", document_id=str(document_id))

