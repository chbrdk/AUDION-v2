from __future__ import annotations

from uuid import UUID

import structlog
from FlagEmbedding import BGEM3FlagModel
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from sqlalchemy import select

from ..core.config import get_settings
from ..db import get_session
from ..models import Document, DocumentChunk, TargetGroup, TargetGroupKnowledgeEntry, TargetGroupSource

logger = structlog.get_logger(__name__)
settings = get_settings()


class KnowledgeIngestionService:
    def __init__(
        self,
        *,
        embedder: BGEM3FlagModel | None = None,
        qdrant: QdrantClient | None = None,
        collection_name: str = "research_chunks",
    ) -> None:
        self._embedder_instance = embedder
        self._qdrant = qdrant or QdrantClient(settings.qdrant_url)
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

    def _get_or_create_virtual_document(self, target_group_id: UUID, session) -> Document:
        """Get or create a virtual document for knowledge entries of a target group."""
        # Try to find existing virtual document
        # Use a more reliable way to identify virtual documents
        virtual_doc = session.scalar(
            select(Document)
            .where(Document.target_group_id == target_group_id)
            .where(Document.file_path == "")  # Virtual documents have empty file_path
            .where(Document.filename.like("Knowledge Base - %"))
        )

        if virtual_doc:
            return virtual_doc

        # Get target group to get project_id
        target_group = session.scalar(
            select(TargetGroup).where(TargetGroup.id == target_group_id)
        )
        if not target_group:
            raise ValueError(f"Target group {target_group_id} not found")

        # Create virtual document
        virtual_doc = Document(
            filename=f"Knowledge Base - {target_group_id}",
            file_path="",  # Virtual document has no file
            content_type="text/plain",
            size_bytes=0,
            status="completed",
            target_group_id=target_group_id,
            uploaded_by="system",
            insight_summary="Virtual document for manual knowledge entries",
        )
        session.add(virtual_doc)
        session.commit()
        session.refresh(virtual_doc)
        logger.info("knowledge.virtual_document.created", target_group_id=str(target_group_id), document_id=str(virtual_doc.id))
        return virtual_doc

    def ingest_knowledge_entry(self, entry_id: UUID) -> None:
        """Create DocumentChunk, embed, and store in Qdrant for a knowledge entry."""
        self._ensure_collection()
        logger.info("knowledge.ingest.start", entry_id=str(entry_id))

        with get_session() as session:
            entry = session.scalar(
                select(TargetGroupKnowledgeEntry).where(TargetGroupKnowledgeEntry.id == entry_id)
            )
            if not entry:
                raise ValueError(f"Knowledge entry {entry_id} not found")

            # Check if chunk already exists (for updates)
            existing_chunk = session.scalar(
                select(DocumentChunk).where(DocumentChunk.knowledge_entry_id == entry_id)
            )

            # Get or create virtual document
            virtual_doc = self._get_or_create_virtual_document(entry.target_group_id, session)

            # Create or update DocumentChunk
            if existing_chunk:
                chunk = existing_chunk
                chunk.content = entry.content
                chunk.chunk_metadata = {
                    "title": entry.title,
                    "knowledge_entry_id": str(entry.id),
                    "source": "manual",
                    "order": 0,
                    "length": len(entry.content),
                }
                session.commit()
                logger.info("knowledge.chunk.updated", entry_id=str(entry_id), chunk_id=str(chunk.id))
            else:
                chunk = DocumentChunk(
                    document_id=virtual_doc.id,
                    knowledge_entry_id=entry.id,
                    content=entry.content,
                    chunk_metadata={
                        "title": entry.title,
                        "knowledge_entry_id": str(entry.id),
                        "source": "manual",
                        "order": 0,
                        "length": len(entry.content),
                    },
                )
                session.add(chunk)
                session.commit()
                session.refresh(chunk)
                logger.info("knowledge.chunk.created", entry_id=str(entry_id), chunk_id=str(chunk.id))

            # Generate embedding
            logger.info("knowledge.embedding.start", entry_id=str(entry_id))
            embedding = self._embedder.encode([entry.content], batch_size=1)["dense_vecs"][0]
            logger.info("knowledge.embedding.complete", entry_id=str(entry_id))

            # Prepare Qdrant payload
            payload = {
                "chunk_id": str(chunk.id),
                "content": entry.content,
                "target_group_id": str(entry.target_group_id),
                "knowledge_entry_id": str(entry.id),
                "source": "manual_knowledge",
                "document_id": str(virtual_doc.id),
            }

            # Store in Qdrant (upsert to handle updates)
            point = qmodels.PointStruct(
                id=str(chunk.id),  # Use chunk UUID as point ID
                vector=embedding,
                payload=payload,
            )
            self._qdrant.upsert(collection_name=self._collection, points=[point])
            logger.info("knowledge.qdrant.stored", entry_id=str(entry_id), chunk_id=str(chunk.id))

            # Create or update TargetGroupSource
            target_group_source = session.query(TargetGroupSource).filter(
                TargetGroupSource.target_group_id == entry.target_group_id,
                TargetGroupSource.chunk_id == chunk.id,
            ).first()

            if not target_group_source:
                target_group_source = TargetGroupSource(
                    target_group_id=entry.target_group_id,
                    chunk_id=chunk.id,
                    relevance_score=1.0,
                    rationale="Manual knowledge entry",
                )
                session.add(target_group_source)
                session.commit()
                logger.info("knowledge.target_group_source.created", entry_id=str(entry_id), chunk_id=str(chunk.id))
            else:
                # Update rationale if needed
                if target_group_source.rationale != "Manual knowledge entry":
                    target_group_source.rationale = "Manual knowledge entry"
                    session.commit()
                logger.info("knowledge.target_group_source.exists", entry_id=str(entry_id), chunk_id=str(chunk.id))

        logger.info("knowledge.ingest.complete", entry_id=str(entry_id))

    def update_knowledge_entry(self, entry_id: UUID) -> None:
        """Update embedding and Qdrant vector for a knowledge entry."""
        # Reuse ingest logic since it handles updates
        self.ingest_knowledge_entry(entry_id)

    def delete_knowledge_entry(self, entry_id: UUID) -> None:
        """Delete chunk, vector, and TargetGroupSource for a knowledge entry."""
        logger.info("knowledge.delete.start", entry_id=str(entry_id))

        with get_session() as session:
            entry = session.query(TargetGroupKnowledgeEntry).filter(TargetGroupKnowledgeEntry.id == entry_id).first()
            if not entry:
                logger.warning("knowledge.delete.entry_not_found", entry_id=str(entry_id))
                return

            # Find associated chunk
            chunk = session.query(DocumentChunk).filter(DocumentChunk.knowledge_entry_id == entry_id).first()
            if not chunk:
                logger.warning("knowledge.delete.chunk_not_found", entry_id=str(entry_id))
                return

            chunk_id = chunk.id

            # Delete TargetGroupSource
            target_group_source = session.query(TargetGroupSource).filter(
                TargetGroupSource.chunk_id == chunk_id
            ).first()
            if target_group_source:
                session.delete(target_group_source)
                logger.info("knowledge.delete.target_group_source", chunk_id=str(chunk_id))

            # Delete chunk (will cascade to knowledge_entry_id relationship)
            session.delete(chunk)
            session.commit()
            logger.info("knowledge.delete.chunk", chunk_id=str(chunk_id))

            # Delete vector from Qdrant
            try:
                self._qdrant.delete(collection_name=self._collection, points_selector=[str(chunk_id)])
                logger.info("knowledge.delete.qdrant", chunk_id=str(chunk_id))
            except Exception as e:
                logger.warning("knowledge.delete.qdrant_failed", chunk_id=str(chunk_id), error=str(e))

        logger.info("knowledge.delete.complete", entry_id=str(entry_id))

