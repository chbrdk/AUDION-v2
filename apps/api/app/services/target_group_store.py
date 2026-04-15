from __future__ import annotations

from typing import List
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from datetime import datetime

from ..core.config import get_settings
from ..models import (
    Document,
    Persona,
    ProcessingJob,
    TargetGroup,
    TargetGroupKnowledgeEntry,
    TargetGroupSource,
)
from ..schemas import (
    PersonaDocument,
    PersonaKnowledgeEntry as PersonaKnowledgeEntrySchema,
    PersonaListItem,
    TargetGroupCreateRequest,
    TargetGroupListResponse,
    TargetGroupListItem,
    TargetGroupResponse,
    TargetGroupUpdateRequest,
)

settings = get_settings()


class TargetGroupService:
    def list_target_groups(
        self,
        session: Session,
        allowed_project_ids: list[UUID] | None = None,
        project_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> TargetGroupListResponse:
        # Subqueries for counts to avoid N+1
        persona_count_subq = (
            select(func.count(Persona.id))
            .where(Persona.target_group_id == TargetGroup.id)
            .correlate(TargetGroup)
            .scalar_subquery()
        )
        
        knowledge_count_subq = (
            select(func.count(TargetGroupKnowledgeEntry.id))
            .where(TargetGroupKnowledgeEntry.target_group_id == TargetGroup.id)
            .correlate(TargetGroup)
            .scalar_subquery()
        )

        query = select(TargetGroup, persona_count_subq, knowledge_count_subq)
        
        if allowed_project_ids is not None:
            if not allowed_project_ids:
                return TargetGroupListResponse(items=[], total=0, page=page, page_size=page_size)
            query = query.where(TargetGroup.project_id.in_(allowed_project_ids))
        if project_id:
            try:
                project_uuid = UUID(project_id)
            except ValueError:
                raise ValueError("invalid_project_id")
            if allowed_project_ids is not None and project_uuid not in allowed_project_ids:
                raise ValueError("project_access_denied")
            query = query.where(TargetGroup.project_id == project_uuid)

        # Get total count (need separate query for count)
        count_query = select(func.count(TargetGroup.id))
        if allowed_project_ids is not None:
            count_query = count_query.where(TargetGroup.project_id.in_(allowed_project_ids))
        if project_id:
             count_query = count_query.where(TargetGroup.project_id == UUID(project_id))
        
        total = session.scalar(count_query)

        # Execute main query
        results = session.execute(
            query.order_by(TargetGroup.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
        ).all()

        list_items = []
        for tg, p_count, k_count in results:
            list_items.append(
                TargetGroupListItem(
                    id=str(tg.id),
                    name=tg.name,
                    segment=tg.segment,
                    description=tg.description,
                    persona_count=p_count or 0,
                    knowledge_entry_count=k_count or 0,
                    created_at=tg.created_at,
                    updated_at=tg.updated_at,
                )
            )

        return TargetGroupListResponse(
            items=list_items,
            total=total or 0,
            page=page,
            page_size=page_size,
        )

    def get_target_group(self, session: Session, target_group_id: str) -> TargetGroupResponse:
        try:
            tg_uuid = UUID(target_group_id)
        except ValueError:
            raise ValueError("invalid_target_group_id")

        tg = session.get(TargetGroup, tg_uuid)
        if not tg:
            raise ValueError("target_group_not_found")

        # Get personas
        personas = session.scalars(select(Persona).where(Persona.target_group_id == tg.id)).all()
        persona_list = [
            PersonaListItem(
                id=str(p.id),
                projectId=str(p.project_id),
                targetGroupId=str(tg.id),
                name=p.name,
                segment=p.segment,
                headline=p.headline,
                status=p.status.value,
                confidence=p.confidence,
                version=p.version,
                updatedAt=p.updated_at,  # camelCase for schema
                updatedBy=p.updated_by,
                imageUrl=p.image_url,
                avatarUrl=p.image_url,  # Map if needed
            )
            for p in personas
        ]

        # Get knowledge entries
        knowledge_entries = session.scalars(
            select(TargetGroupKnowledgeEntry).where(TargetGroupKnowledgeEntry.target_group_id == tg.id)
        ).all()
        knowledge_list = [
            PersonaKnowledgeEntrySchema(
                id=str(ke.id),
                personaId=str(tg.id),  # For compatibility
                title=ke.title,
                content=ke.content,
                metadata=ke.metadata_payload,
                createdBy=ke.created_by,
                createdAt=ke.created_at,
            )
            for ke in knowledge_entries
        ]

        # Get sources
        sources = session.scalars(
            select(TargetGroupSource).where(TargetGroupSource.target_group_id == tg.id)
        ).all()
        source_list = [
            {"chunk_id": str(s.chunk_id), "relevance_score": s.relevance_score}
            for s in sources
        ]

        return TargetGroupResponse(
            id=str(tg.id),
            project_id=str(tg.project_id),
            name=tg.name,
            segment=tg.segment,
            description=tg.description,
            personas=persona_list,
            knowledge_entries=knowledge_list,
            sources=source_list,
            created_at=tg.created_at,
            updated_at=tg.updated_at,
        )

    def create_target_group(
        self, session: Session, payload: TargetGroupCreateRequest
    ) -> TargetGroupResponse:
        # Validate and convert project_id
        project_id_str = payload.project_id.strip() if payload.project_id else ""
        if not project_id_str:
            raise ValueError("project_id is required")
        
        try:
            project_id = UUID(project_id_str)
        except ValueError as exc:
            raise ValueError(f"badly formed hexadecimal UUID string: {project_id_str}") from exc
        
        tg = TargetGroup(
            project_id=project_id,
            name=payload.name,
            segment=payload.segment,
            description=payload.description,
            updated_by=getattr(payload, "updated_by", None),
        )
        session.add(tg)
        session.commit()
        session.refresh(tg)
        return self.get_target_group(session, str(tg.id))

    def update_target_group(
        self, session: Session, target_group_id: str, payload: TargetGroupUpdateRequest
    ) -> TargetGroupResponse:
        try:
            tg_uuid = UUID(target_group_id)
        except ValueError:
            raise ValueError("invalid_target_group_id")

        tg = session.get(TargetGroup, tg_uuid)
        if not tg:
            raise ValueError("target_group_not_found")

        if payload.name is not None:
            tg.name = payload.name
        if payload.description is not None:
            tg.description = payload.description
        if payload.segment is not None:
            tg.segment = payload.segment
        if payload.updated_by:
            tg.updated_by = payload.updated_by

        session.commit()
        session.refresh(tg)
        return self.get_target_group(session, str(tg.id))

    def list_knowledge(
        self, session: Session, target_group_id: str
    ) -> List[PersonaKnowledgeEntrySchema]:
        try:
            tg_uuid = UUID(target_group_id)
        except ValueError:
            raise ValueError("invalid_target_group_id")

        tg = session.get(TargetGroup, tg_uuid)
        if not tg:
            raise ValueError("target_group_not_found")

        knowledge_entries = session.scalars(
            select(TargetGroupKnowledgeEntry).where(TargetGroupKnowledgeEntry.target_group_id == tg.id)
        ).all()

        return [
            PersonaKnowledgeEntrySchema(
                id=str(ke.id),
                personaId=str(tg.id),  # For compatibility
                title=ke.title,
                content=ke.content,
                metadata=ke.metadata_payload,
                createdBy=ke.created_by,
                createdAt=ke.created_at,
            )
            for ke in knowledge_entries
        ]

    def serialize_knowledge_entry(
        self, entry: TargetGroupKnowledgeEntry, target_group_id: str
    ) -> PersonaKnowledgeEntrySchema:
        return PersonaKnowledgeEntrySchema(
            id=str(entry.id),
            personaId=target_group_id,  # For compatibility
            title=entry.title,
            content=entry.content,
            metadata=entry.metadata_payload,
            createdBy=entry.created_by,
            createdAt=entry.created_at,
        )

    def list_documents(self, session: Session, target_group_id: str) -> List[PersonaDocument]:
        try:
            tg_uuid = UUID(target_group_id)
        except ValueError:
            raise ValueError("invalid_target_group_id")

        tg = session.get(TargetGroup, tg_uuid)
        if not tg:
            raise ValueError("target_group_not_found")

        # Get documents that belong directly to this target group
        from sqlalchemy import select
        records = session.scalars(
            select(Document)
            .where(Document.target_group_id == tg_uuid)
            .order_by(Document.created_at.desc())
        ).all()
        return [self._to_document_payload(record, session=session, target_group_id=target_group_id) for record in records]

    def _to_document_payload(self, document: Document, session: Session | None = None, target_group_id: str | None = None) -> PersonaDocument:
        ingestion_status = None
        ingestion_progress = None

        # Load ProcessingJob if session is available
        if session:
            from sqlalchemy import select
            job = session.scalar(
                select(ProcessingJob)
                .where(ProcessingJob.document_id == document.id)
                .order_by(ProcessingJob.created_at.desc())
            )
            if job:
                ingestion_status = job.status
                ingestion_progress = job.progress

        # Build download URL - use target_group_id if available, otherwise fallback to persona_id
        download_url = None
        public_base = settings.persona_backend_public_url.rstrip("/") if settings.persona_backend_public_url else None
        if public_base:
            if target_group_id:
                download_url = f"{public_base}/target-groups/{target_group_id}/documents/{document.id}/download"
            elif document.persona_id:
                download_url = f"{public_base}/personas/{document.persona_id}/documents/{document.id}/download"

        return PersonaDocument(
            id=str(document.id),
            filename=document.filename,
            contentType=document.content_type,
            sizeBytes=document.size_bytes,
            uploadedAt=document.created_at or datetime.utcnow(),
            uploadedBy=document.uploaded_by,
            downloadUrl=download_url,
            insightSummary=document.insight_summary,
            ingestionStatus=ingestion_status,
            ingestionProgress=ingestion_progress,
        )
