"""
Migration script to ingest existing TargetGroupKnowledgeEntry records.

This script finds all existing knowledge entries that don't have associated chunks
and creates DocumentChunks, embeddings, and Qdrant vectors for them.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add parent directory to path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "app"))


import structlog  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.db import get_session  # noqa: E402
from app.models import DocumentChunk, TargetGroupKnowledgeEntry  # noqa: E402
from app.services.knowledge_ingestion import KnowledgeIngestionService  # noqa: E402

logger = structlog.get_logger(__name__)


def migrate_existing_knowledge_entries() -> None:
    """Migrate all existing knowledge entries that don't have chunks yet."""
    logger.info("migration.knowledge.start")

    knowledge_service = KnowledgeIngestionService()
    migrated_count = 0
    error_count = 0

    with get_session() as session:
        # Find all knowledge entries
        entries = session.scalars(select(TargetGroupKnowledgeEntry)).all()
        logger.info("migration.knowledge.found_entries", count=len(entries))

        for entry in entries:
            # Check if chunk already exists
            existing_chunk = session.query(DocumentChunk).filter(
                DocumentChunk.knowledge_entry_id == entry.id
            ).first()

            if existing_chunk:
                logger.info(
                    "migration.knowledge.already_migrated",
                    entry_id=str(entry.id),
                    chunk_id=str(existing_chunk.id),
                )
                continue

            try:
                logger.info("migration.knowledge.ingesting", entry_id=str(entry.id))
                knowledge_service.ingest_knowledge_entry(entry.id)
                migrated_count += 1
                logger.info("migration.knowledge.success", entry_id=str(entry.id))
            except Exception as e:
                error_count += 1
                logger.error(
                    "migration.knowledge.failed",
                    entry_id=str(entry.id),
                    error=str(e),
                )

    logger.info(
        "migration.knowledge.complete",
        migrated=migrated_count,
        errors=error_count,
        total=len(entries) if 'entries' in locals() else 0,
    )


if __name__ == "__main__":
    migrate_existing_knowledge_entries()

