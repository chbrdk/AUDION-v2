from __future__ import annotations

import structlog
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..db import get_session
from ..models import Document, Persona, TargetGroup

logger = structlog.get_logger(__name__)
settings = get_settings()


class QdrantMigrationService:
    def __init__(self) -> None:
        self._qdrant = QdrantClient(settings.qdrant_url)
        self._collection = "research_chunks"

    def migrate_existing_points(self, *, batch_size: int = 100) -> dict:
        """
        Migrate existing Qdrant points to include target_group_id.
        
        For each point:
        1. If point has persona_id, look up Persona and get target_group_id
        2. If point has persona_segment but no persona_id, find Target Group by segment
        3. Update point with target_group_id
        
        Returns:
            dict with migration statistics
        """
        logger.info("qdrant.migration.start")
        
        with get_session() as session:
            # Get all points from Qdrant
            all_points = []
            offset = None
            
            while True:
                result = self._qdrant.scroll(
                    collection_name=self._collection,
                    limit=batch_size,
                    offset=offset,
                    with_vectors=False,
                    with_payload=True,
                )
                
                points, next_offset = result
                if not points:
                    break
                
                all_points.extend(points)
                
                if next_offset is None:
                    break
                offset = next_offset
        
        logger.info("qdrant.migration.points_found", count=len(all_points))
        
        # Process points in batches
        updated_count = 0
        skipped_count = 0
        error_count = 0
        
        for point in all_points:
            try:
                payload = point.payload or {}
                point_id = point.id
                
                # Check if already has target_group_id
                if "target_group_id" in payload:
                    skipped_count += 1
                    continue
                
                target_group_id = None
                
                # Strategy 1: Get from persona_id
                if "persona_id" in payload:
                    persona_id_str = payload["persona_id"]
                    try:
                        from uuid import UUID
                        persona_uuid = UUID(persona_id_str)
                        persona = session.get(Persona, persona_uuid)
                        if persona and persona.target_group_id:
                            target_group_id = str(persona.target_group_id)
                            logger.debug(
                                "qdrant.migration.found_via_persona",
                                point_id=str(point_id),
                                persona_id=persona_id_str,
                                target_group_id=target_group_id,
                            )
                    except Exception as exc:
                        logger.warning(
                            "qdrant.migration.persona_lookup_failed",
                            point_id=str(point_id),
                            persona_id=persona_id_str,
                            error=str(exc),
                        )
                
                # Strategy 2: Get from persona_segment if no persona_id
                if not target_group_id and "persona_segment" in payload:
                    persona_segment = payload["persona_segment"]
                    try:
                        # Find target group by segment (use first one found)
                        target_group = session.scalars(
                            select(TargetGroup).where(TargetGroup.segment == persona_segment).limit(1)
                        ).first()
                        if target_group:
                            target_group_id = str(target_group.id)
                            logger.debug(
                                "qdrant.migration.found_via_segment",
                                point_id=str(point_id),
                                segment=persona_segment,
                                target_group_id=target_group_id,
                            )
                    except Exception as exc:
                        logger.warning(
                            "qdrant.migration.segment_lookup_failed",
                            point_id=str(point_id),
                            segment=persona_segment,
                            error=str(exc),
                        )
                
                # Strategy 3: Get from document_id -> persona_id -> target_group_id
                if not target_group_id and "document_id" in payload:
                    document_id_str = payload["document_id"]
                    try:
                        from uuid import UUID
                        document_uuid = UUID(document_id_str)
                        document = session.get(Document, document_uuid)
                        if document and document.persona_id:
                            persona = session.get(Persona, document.persona_id)
                            if persona and persona.target_group_id:
                                target_group_id = str(persona.target_group_id)
                                logger.debug(
                                    "qdrant.migration.found_via_document",
                                    point_id=str(point_id),
                                    document_id=document_id_str,
                                    target_group_id=target_group_id,
                                )
                    except Exception as exc:
                        logger.warning(
                            "qdrant.migration.document_lookup_failed",
                            point_id=str(point_id),
                            document_id=document_id_str,
                            error=str(exc),
                        )
                
                # Update point if target_group_id found
                if target_group_id:
                    self._qdrant.set_payload(
                        collection_name=self._collection,
                        payload={"target_group_id": target_group_id},
                        points=[point_id],
                    )
                    updated_count += 1
                    logger.debug(
                        "qdrant.migration.point_updated",
                        point_id=str(point_id),
                        target_group_id=target_group_id,
                    )
                else:
                    skipped_count += 1
                    logger.debug("qdrant.migration.point_skipped", point_id=str(point_id))
                    
            except Exception as exc:
                error_count += 1
                logger.error(
                    "qdrant.migration.point_error",
                    point_id=str(point_id),
                    error=str(exc),
                )
        
        result = {
            "total_points": len(all_points),
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": error_count,
        }
        
        logger.info("qdrant.migration.complete", **result)
        return result

