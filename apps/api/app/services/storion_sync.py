"""STORION Chunk Synchronization Service"""
from __future__ import annotations

import asyncio
from typing import Dict, Any
from uuid import UUID
from datetime import datetime

import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import Document, DocumentChunk, TargetGroupSource
from ..services.storion_client import storion_client

logger = structlog.get_logger(__name__)
settings = get_settings()


class StorionSyncService:
    """Service for synchronizing STORION chunks into local database."""
    
    def __init__(self):
        self.poll_interval = settings.storion_sync_poll_interval
        self.poll_timeout = settings.storion_sync_poll_timeout
    
    async def poll_job_until_complete(
        self,
        job_id: str,
        timeout: float | None = None,
    ) -> Dict[str, Any]:
        """Poll STORION job status until completion or timeout.
        
        Args:
            job_id: STORION processing job UUID string
            timeout: Maximum seconds to wait (defaults to storion_sync_poll_timeout)
        
        Returns:
            Job status dict with "status" field
        
        Raises:
            TimeoutError: If job doesn't complete within timeout
            RuntimeError: If job fails
        """
        timeout = timeout or self.poll_timeout
        start_time = datetime.now().timestamp()
        
        logger.info("storion_sync.polling_start", job_id=job_id, timeout=timeout)
        
        while True:
            elapsed = datetime.now().timestamp() - start_time
            if elapsed >= timeout:
                logger.error("storion_sync.polling_timeout", job_id=job_id, elapsed=elapsed)
                raise TimeoutError(f"Job {job_id} did not complete within {timeout}s")
            
            try:
                status = await storion_client.get_job_status(job_id)
                job_status = status.get("status", "unknown")
                progress = status.get("progress", 0)
                
                logger.debug(
                    "storion_sync.polling_status",
                    job_id=job_id,
                    status=job_status,
                    progress=progress,
                    elapsed=elapsed,
                )
                
                if job_status == "completed":
                    logger.info("storion_sync.polling_complete", job_id=job_id, elapsed=elapsed)
                    return status
                elif job_status == "failed":
                    error_msg = status.get("error", "Unknown error")
                    logger.error("storion_sync.polling_failed", job_id=job_id, error=error_msg)
                    raise RuntimeError(f"Job {job_id} failed: {error_msg}")
                
                # Wait before next poll
                await asyncio.sleep(self.poll_interval)
            
            except Exception as e:
                if isinstance(e, (TimeoutError, RuntimeError)):
                    raise
                logger.warning(
                    "storion_sync.polling_error",
                    job_id=job_id,
                    error=str(e),
                    error_type=type(e).__name__,
                )
                # Continue polling on transient errors
                await asyncio.sleep(self.poll_interval)
    
    async def sync_chunks_for_target_group(
        self,
        session: Session,
        target_group_id: UUID,
        document_id: UUID,
        storion_file_id: str,
    ) -> int:
        """Synchronize STORION chunks for a target group into local database.
        
        After STORION has processed a file, this method retrieves all chunks
        associated with the target group and creates DocumentChunk and
        TargetGroupSource entries for backward compatibility.
        
        Args:
            session: Database session
            target_group_id: Target group UUID
            document_id: Local document UUID
            storion_file_id: STORION file UUID string
        
        Returns:
            Number of chunks synchronized
        """
        logger.info(
            "storion_sync.sync_start",
            target_group_id=str(target_group_id),
            document_id=str(document_id),
            storion_file_id=storion_file_id,
        )
        
        try:
            # Get chunks from STORION for this file
            chunks = await storion_client.get_file_chunks(
                file_id=storion_file_id,
                limit=10000,  # Large limit to get all chunks
            )
            
            if not chunks:
                logger.warning(
                    "storion_sync.no_chunks",
                    target_group_id=str(target_group_id),
                    storion_file_id=storion_file_id,
                )
                return 0
            
            logger.info(
                "storion_sync.chunks_retrieved",
                target_group_id=str(target_group_id),
                chunks_count=len(chunks),
            )
            
            # Create DocumentChunk and TargetGroupSource entries
            synced_count = 0
            for chunk_data in chunks:
                try:
                    # Extract chunk information from STORION response
                    chunk_id_str = chunk_data.get("id", "")
                    content = chunk_data.get("content", "")
                    metadata = chunk_data.get("metadata", {})
                    
                    if not chunk_id_str or not content:
                        logger.warning(
                            "storion_sync.invalid_chunk",
                            chunk_id=chunk_id_str,
                            has_content=bool(content),
                        )
                        continue
                    
                    # Parse chunk_id as UUID
                    try:
                        chunk_uuid = UUID(chunk_id_str)
                    except ValueError:
                        logger.warning(
                            "storion_sync.invalid_chunk_id",
                            chunk_id=chunk_id_str,
                        )
                        continue
                    
                    # Check if DocumentChunk already exists
                    existing_chunk = session.get(DocumentChunk, chunk_uuid)
                    if existing_chunk:
                        logger.debug(
                            "storion_sync.chunk_exists",
                            chunk_id=chunk_id_str,
                        )
                        # Update existing chunk
                        existing_chunk.content = content
                        existing_chunk.chunk_metadata = metadata
                    else:
                        # Create new DocumentChunk
                        document_chunk = DocumentChunk(
                            id=chunk_uuid,
                            document_id=document_id,
                            content=content,
                            chunk_metadata=metadata,
                        )
                        session.add(document_chunk)
                    
                    # Check if TargetGroupSource already exists
                    existing_source = session.scalar(
                        select(TargetGroupSource)
                        .where(
                            TargetGroupSource.target_group_id == target_group_id,
                            TargetGroupSource.chunk_id == chunk_uuid,
                        )
                        .limit(1)
                    )
                    
                    if not existing_source:
                        # Create TargetGroupSource entry
                        target_group_source = TargetGroupSource(
                            target_group_id=target_group_id,
                            chunk_id=chunk_uuid,
                            relevance_score=1.0,  # Default relevance
                        )
                        session.add(target_group_source)
                    
                    synced_count += 1
                
                except Exception as e:
                    logger.error(
                        "storion_sync.chunk_sync_error",
                        chunk_id=chunk_data.get("id", "unknown"),
                        error=str(e),
                        error_type=type(e).__name__,
                        exc_info=True,
                    )
                    # Continue with next chunk
                    continue
            
            # Update document status
            document = session.get(Document, document_id)
            if document:
                document.status = "completed"
            
            session.commit()
            
            logger.info(
                "storion_sync.sync_complete",
                target_group_id=str(target_group_id),
                document_id=str(document_id),
                synced_count=synced_count,
            )
            
            return synced_count
        
        except Exception as e:
            logger.error(
                "storion_sync.sync_failed",
                target_group_id=str(target_group_id),
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
                exc_info=True,
            )
            # Update document status to failed
            try:
                document = session.get(Document, document_id)
                if document:
                    document.status = "failed"
                session.commit()
            except Exception:
                session.rollback()
            raise


# Global instance
storion_sync_service = StorionSyncService()

