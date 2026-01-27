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

from sqlalchemy import select

from ..core.config import get_settings
from ..db import get_session
from ..models import Document, DocumentChunk, ProcessingJob, TargetGroupSource

logger = structlog.get_logger(__name__)
settings = get_settings()


# STANDALONE: Für spätere Standalone-Version beibehalten
# Diese Klasse wird nur verwendet wenn use_storion_proxy=False
# Bei aktiviertem STORION Proxy wird die Verarbeitung vollständig von STORION übernommen
class IngestionService:
    def __init__(
        self,
        *,
        embedder: BGEM3FlagModel | None = None,
        qdrant: QdrantClient | None = None,
        collection_name: str = "research_chunks",
    ) -> None:
        self._embedder_instance = embedder
        self._qdrant = qdrant or QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
        self._collection = collection_name

    @property
    def _embedder(self) -> BGEM3FlagModel:
        """Lazy-load the embedder model to avoid loading it at import time."""
        if self._embedder_instance is None:
            self._embedder_instance = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
        return self._embedder_instance

    def _ensure_collection(self) -> None:
        if not self._qdrant.collection_exists(self._collection):
            self._qdrant.create_collection(
                collection_name=self._collection,
                vectors_config=qmodels.VectorParams(size=1024, distance=qmodels.Distance.COSINE),
            )

    def ingest(self, *, document_id: UUID, file_path: Path) -> None:
        file_path = file_path.resolve()
        self._ensure_collection()
        logger.info("ingest.start", document_id=str(document_id), file_path=str(file_path))

        with get_session() as session:
            job: ProcessingJob | None = session.scalar(
                select(ProcessingJob).where(ProcessingJob.document_id == document_id)
            )
            if not job:
                # Create job if it doesn't exist
                logger.warning("ingest.job_not_found_creating", document_id=str(document_id))
                job = ProcessingJob(document_id=document_id, status="pending", progress=0)
                session.add(job)
                session.commit()
                logger.info("ingest.job_created", document_id=str(document_id))
            else:
                logger.info("ingest.job_found", document_id=str(document_id), job_status=job.status, job_progress=job.progress)
                # If job is already processing or completed, skip to avoid duplicate processing
                if job.status == "processing":
                    logger.warning("ingest.job_already_processing", document_id=str(document_id), job_id=str(job.id))
                    return
                # If job is completed, reset it for retry
                if job.status == "completed":
                    logger.info("ingest.job_resetting_for_retry", document_id=str(document_id), job_id=str(job.id))
                    job.status = "pending"
                    job.progress = 0
                    job.error = None
                    session.commit()
            
            # Set status to processing atomically
            job.status = "processing"
            job.progress = 5
            session.commit()
            
            # Get document to check for persona_id and target_group_id
            from ..models import Persona
            document = session.get(Document, document_id)
            if not document:
                job.status = "failed"
                job.error = "Document not found"
                session.commit()
                raise RuntimeError("Document not found")
            persona_id = str(document.persona_id) if document.persona_id else None
            target_group_id = None
            persona_segment = None
            # Prioritize direct target_group_id on document, fallback to persona.target_group_id
            if document.target_group_id:
                target_group_id = str(document.target_group_id)
            elif document.persona_id:
                persona = session.get(Persona, document.persona_id)
                if persona:
                    persona_segment = persona.segment  # For backward compatibility
                    if persona.target_group_id:
                        target_group_id = str(persona.target_group_id)

        # Check if file exists
        if not file_path.exists():
            logger.error("ingest.file_not_found", document_id=str(document_id), file_path=str(file_path))
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                )
                if job:
                    job.status = "failed"
                    job.error = f"File not found: {file_path}"
                document = session.get(Document, document_id)
                if document:
                    document.status = "failed"
                session.commit()
            raise FileNotFoundError(f"File not found: {file_path}")

        try:
            # Update progress: starting parsing
            logger.info("ingest.partition.start", document_id=str(document_id), file_path=str(file_path))
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                )
                if job:
                    job.progress = 10  # Indicate parsing has started
                    session.commit()
            
            elements = partition(filename=str(file_path))
            cleaned_chunks = [chunk.text.strip() for chunk in elements if getattr(chunk, "text", "").strip()]
            logger.info("ingest.partition.complete", document_id=str(document_id), chunks_count=len(cleaned_chunks))

            if not cleaned_chunks:
                logger.warning("ingest.no_chunks", document_id=str(document_id))
                with get_session() as session:
                    job = session.scalar(
                        select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                    )
                    if job:
                        job.status = "completed"
                        job.progress = 100
                    document = session.get(Document, document_id)
                    if document:
                        document.status = "completed"
                    session.commit()
                return

            # Update progress: parsing complete
            logger.info("ingest.progress.parsing_complete", document_id=str(document_id), progress=20)
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                )
                if job:
                    job.progress = 20
                    session.commit()

            logger.info("ingest.embedding.start", document_id=str(document_id), chunks_count=len(cleaned_chunks))
            embeddings = self._embedder.encode(cleaned_chunks, batch_size=8)["dense_vecs"]
            logger.info("ingest.embedding.complete", document_id=str(document_id), embeddings_count=len(embeddings))
        
            # Update progress: embeddings complete
            logger.info("ingest.progress.embeddings_complete", document_id=str(document_id), progress=50)
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                )
                if job:
                    job.progress = 50
                    session.commit()
        
            logger.info("ingest.chunks.processing_start", document_id=str(document_id), total_chunks=len(cleaned_chunks))
            points = []
            chunk_ids = []  # Track chunk IDs for TargetGroupSource creation
            total_chunks = len(cleaned_chunks)
            for idx, (text, vector) in enumerate(zip(cleaned_chunks, embeddings, strict=True)):
                chunk = DocumentChunk(
                    document_id=document_id,
                    content=text,
                    chunk_metadata={"order": idx, "length": len(text)},
                )
                with get_session() as session:
                    session.add(chunk)
                    session.commit()
                    chunk_id = str(chunk.id)
                    chunk_ids.append(chunk.id)  # Store UUID, not string
                    logger.debug("ingest.chunk.saved", document_id=str(document_id), chunk_index=idx, chunk_id=chunk_id)

                payload = {
                    "document_id": str(document_id),
                    "chunk_id": chunk_id,
                    "content": text,
                    "order": idx,
                }
                # Add persona_id to payload if available for filtering
                if persona_id:
                    payload["persona_id"] = persona_id
                # Add target_group_id to payload if available (priority for filtering)
                if target_group_id:
                    payload["target_group_id"] = target_group_id
                # Add persona_segment for backward compatibility
                if persona_segment:
                    payload["persona_segment"] = persona_segment

                points.append(
                    qmodels.PointStruct(
                        id=chunk_id,  # Use chunk UUID as point ID (Qdrant requires UUID or integer, not composite strings)
                        vector=vector,
                        payload=payload,
                    )
                )
                
                # Update progress: processing chunks
                if (idx + 1) % 10 == 0 or idx == total_chunks - 1:
                    with get_session() as session:
                        job = session.scalar(
                            select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                        )
                        if job:
                            # Progress: 50% (embeddings) + 30% (chunks) = 80% max
                            job.progress = 50 + int(30 * (idx + 1) / total_chunks)
                            session.commit()

            # Update progress: storing in Qdrant
            logger.info("ingest.qdrant.storing", document_id=str(document_id), points_count=len(points), progress=90)
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                )
                if job:
                    job.progress = 90
                    session.commit()

            self._qdrant.upsert(collection_name=self._collection, points=points)
            logger.info("ingest.qdrant.stored", document_id=str(document_id), points_count=len(points))

            # Create TargetGroupSource entries if target_group_id is present
            if target_group_id and chunk_ids:
                from uuid import UUID as UUIDType
                target_group_uuid = UUIDType(target_group_id)
                logger.info("ingest.target_group_sources.creating", document_id=str(document_id), target_group_id=target_group_id, chunk_count=len(chunk_ids))
                with get_session() as session:
                    for chunk_id in chunk_ids:
                        # Check if TargetGroupSource already exists to avoid duplicates
                        existing = session.scalar(
                            select(TargetGroupSource)
                            .where(TargetGroupSource.target_group_id == target_group_uuid)
                            .where(TargetGroupSource.chunk_id == chunk_id)
                        )
                        if not existing:
                            target_group_source = TargetGroupSource(
                                target_group_id=target_group_uuid,
                                chunk_id=chunk_id,
                                relevance_score=1.0,  # Default relevance score, can be adjusted later
                                rationale="Automatic source from document ingestion",
                            )
                            session.add(target_group_source)
                    session.commit()
                    logger.info("ingest.target_group_sources.created", document_id=str(document_id), target_group_id=target_group_id, count=len(chunk_ids))

            logger.info("ingest.completing", document_id=str(document_id), progress=100)
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                )
                if job:
                    job.status = "completed"
                    job.progress = 100
                    job.updated_at = datetime.utcnow()
                document = session.get(Document, document_id)
                if document:
                    document.status = "completed"
                    document.updated_at = datetime.utcnow()
                session.commit()

            logger.info("ingest.completed", document_id=str(document_id))
        except Exception as exc:
            logger.error("ingest.failed", document_id=str(document_id), error=str(exc), error_type=type(exc).__name__, exc_info=True)
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                )
                if job:
                    job.status = "failed"
                    job.error = str(exc)
                    job.progress = 0
                document = session.get(Document, document_id)
                if document:
                    document.status = "failed"
                session.commit()
            raise

