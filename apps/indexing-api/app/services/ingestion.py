from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import UUID

import structlog
from FlagEmbedding import BGEM3FlagModel
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from unstructured.partition.auto import partition

from sqlalchemy import select

from ..core.config import get_settings
from ..db import get_session
from ..models import Document, DocumentChunk, ProcessingJob

logger = structlog.get_logger(__name__)
settings = get_settings()


class IngestionService:
    def __init__(self) -> None:
        # Disable FP16 to avoid SIGSEGV issues in Docker/Celery workers
        self._embedder = BGEM3FlagModel("BAAI/bge-m3", use_fp16=False)
        self._qdrant = QdrantClient(settings.qdrant_url)
        self._collection = "research_chunks"

    def _ensure_collection(self) -> None:
        """Ensure the Qdrant collection exists."""
        if not self._qdrant.collection_exists(self._collection):
            self._qdrant.create_collection(
                collection_name=self._collection,
                vectors_config=qmodels.VectorParams(size=1024, distance=qmodels.Distance.COSINE),
            )

    def ingest(self, *, document_id: UUID, file_path: Path) -> None:
        """Process a document: parse, chunk, embed, and store."""
        self._ensure_collection()
        logger.info("ingest.start", document_id=str(document_id))

        with get_session() as session:
            job: ProcessingJob | None = session.scalar(
                select(ProcessingJob).where(ProcessingJob.document_id == document_id)
            )
            if not job:
                raise RuntimeError("Processing job missing")
            job.status = "processing"
            job.progress = 5
            session.commit()

        # Parse document
        logger.info("ingest.parsing", document_id=str(document_id), file_path=str(file_path))
        try:
            elements = partition(filename=str(file_path))
            logger.info("ingest.parsed", document_id=str(document_id), elements_count=len(elements))
        except Exception as e:
            logger.error("ingest.parse_failed", document_id=str(document_id), error=str(e), error_type=type(e).__name__)
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                )
                if job:
                    job.status = "failed"
                    job.error = f"Parse error: {str(e)}"
                    session.commit()
            raise

        cleaned_chunks = [chunk.text.strip() for chunk in elements if chunk.text]
        logger.info("ingest.chunks_cleaned", document_id=str(document_id), chunks_count=len(cleaned_chunks))
        
        # Update progress after parsing
        with get_session() as session:
            job = session.scalar(
                select(ProcessingJob).where(ProcessingJob.document_id == document_id)
            )
            if job:
                job.progress = 20
                session.commit()

        if not cleaned_chunks:
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                )
                if job:
                    job.status = "failed"
                    job.error = "No text content extracted from document"
                    session.commit()
            logger.warning("ingest.no_content", document_id=str(document_id))
            return

        # Generate embeddings with optimized dynamic batch size
        logger.info("ingest.embedding_start", document_id=str(document_id), chunks_count=len(cleaned_chunks))
        embeddings = []
        
        # Dynamic batch size: adapt based on chunk count and estimated memory
        # Start with 8 (optimized from previous 4), scale up for larger documents
        # Conservative: 4 for small batches, 8-12 for medium, up to 16 for large
        total_chunks = len(cleaned_chunks)
        if total_chunks <= 20:
            batch_size = 4  # Small documents: conservative
        elif total_chunks <= 100:
            batch_size = 8  # Medium documents: balanced
        elif total_chunks <= 500:
            batch_size = 12  # Large documents: optimized
        else:
            batch_size = 16  # Very large documents: maximum (with monitoring)
        
        logger.info("ingest.embedding_batch_size", document_id=str(document_id), batch_size=batch_size, chunks_count=total_chunks)
        
        try:
            for i in range(0, len(cleaned_chunks), batch_size):
                batch = cleaned_chunks[i:i + batch_size]
                logger.info("ingest.embedding_batch", document_id=str(document_id), batch_num=i//batch_size + 1, total_batches=(len(cleaned_chunks) + batch_size - 1) // batch_size)
                batch_embeddings = self._embedder.encode(batch, batch_size=len(batch))["dense_vecs"]
                embeddings.extend(batch_embeddings)
            logger.info("ingest.embedding_encode_complete", document_id=str(document_id), vectors_count=len(embeddings))
        except Exception as e:
            logger.error("ingest.embedding_failed", document_id=str(document_id), error=str(e), error_type=type(e).__name__)
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                )
                if job:
                    job.status = "failed"
                    job.error = f"Embedding error: {str(e)}"
                    session.commit()
            raise
        
        # Update progress
        with get_session() as session:
            job = session.scalar(
                select(ProcessingJob).where(ProcessingJob.document_id == document_id)
            )
            if job:
                job.progress = 50
                session.commit()
        
        points = []

        # Store chunks and create Qdrant points
        logger.info("ingest.storing_chunks", document_id=str(document_id), total_chunks=len(cleaned_chunks))
        for idx, (text, vector) in enumerate(zip(cleaned_chunks, embeddings, strict=True)):
            chunk = DocumentChunk(
                document_id=document_id,
                content=text,
                chunk_metadata={"order": idx, "length": len(text)},
            )
            chunk_id: UUID
            with get_session() as session:
                session.add(chunk)
                session.commit()
                session.refresh(chunk)  # Refresh to ensure ID is loaded
                chunk_id = chunk.id

            points.append(
                qmodels.PointStruct(
                    id=str(chunk_id),  # Use chunk UUID as point ID (Qdrant requires UUID or integer)
                    vector=vector,
                    payload={
                        "document_id": str(document_id),
                        "chunk_id": str(chunk_id),
                        "content": text,
                        "order": idx,
                    },
                )
            )

        # Upsert to Qdrant
        logger.info("ingest.qdrant_upsert", document_id=str(document_id), points_count=len(points))
        try:
            # Validate vector size before upsert
            if points:
                vector_size = len(points[0].vector)
                logger.info("ingest.vector_size_check", document_id=str(document_id), vector_size=vector_size, expected_size=1024)
                if vector_size != 1024:
                    raise ValueError(f"Vector size mismatch: expected 1024, got {vector_size}")
            
            self._qdrant.upsert(collection_name=self._collection, points=points)
            logger.info("ingest.qdrant_complete", document_id=str(document_id))
        except Exception as e:
            logger.error("ingest.qdrant_failed", document_id=str(document_id), error=str(e), error_type=type(e).__name__)
            # Log first point details for debugging
            if points:
                logger.error("ingest.qdrant_point_sample", 
                    point_id=points[0].id,
                    vector_size=len(points[0].vector) if hasattr(points[0], 'vector') else None,
                    payload_keys=list(points[0].payload.keys()) if hasattr(points[0], 'payload') else None
                )
            with get_session() as session:
                job = session.scalar(
                    select(ProcessingJob).where(ProcessingJob.document_id == document_id)
                )
                if job:
                    job.status = "failed"
                    job.error = f"Qdrant upsert error: {str(e)}"
                    session.commit()
            raise
        
        # Update progress
        with get_session() as session:
            job = session.scalar(
                select(ProcessingJob).where(ProcessingJob.document_id == document_id)
            )
            if job:
                job.progress = 90
                session.commit()

        # Update job and document status
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

        logger.info("ingest.completed", document_id=str(document_id), chunks=len(cleaned_chunks))

