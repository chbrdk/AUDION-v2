from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Protocol
from uuid import UUID

import orjson
import structlog
from neo4j import GraphDatabase
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from redis import Redis
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session
from msqdx_glass_proto import PersonaProfile, PersonaPrompt

from ..core.config import get_settings
from ..models import (
    Document,
    Persona,
    PersonaAuditAction,
    PersonaAuditLog,
    PersonaKnowledgeEntry,
    PersonaPrompt as PersonaPromptModel,
    PersonaSource,
    PersonaStatus,
)
from ..schemas import (
    PersonaCreateRequest,
    PersonaDocument,
    PersonaInsight,
    PersonaKnowledgeEntry as PersonaKnowledgeEntrySchema,
    PersonaListItem,
    PersonaListResponse,
    PersonaMetadata,
    PersonaPatchRequest,
    PersonaResponse,
)
from .storage import StorageService

logger = structlog.get_logger(__name__)
settings = get_settings()

# Backward compatibility: DB may still have headline VARCHAR(256) until migration 20260309 is applied.
# Truncate so PATCH/create succeed; after migration, increase or set to 0 to disable.
HEADLINE_MAX_LENGTH = 256


def _truncate_headline(value: str | None) -> str | None:
    if value is None:
        return None
    if HEADLINE_MAX_LENGTH <= 0 or len(value) <= HEADLINE_MAX_LENGTH:
        return value
    return value[: HEADLINE_MAX_LENGTH - 3] + "..."


class PersonaInsightsBuilder(Protocol):
    def build(self, *, persona: Persona, sources: List[PersonaSource]) -> PersonaInsight | None: ...


@dataclass
class LivePersonaInsightsBuilder:
    qdrant_client: QdrantClient | None = None
    neo4j_driver: Any | None = None
    collection_name: str = "research_chunks"

    def __post_init__(self) -> None:
        if not self.qdrant_client:
            self.qdrant_client = QdrantClient(settings.qdrant_url)
        if not self.neo4j_driver:
            self.neo4j_driver = GraphDatabase.driver(settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password))

    def build(self, *, persona: Persona, sources: List[PersonaSource]) -> PersonaInsight | None:
        related_chunk_ids = [str(source.chunk_id) for source in sources][:10]
        chunk_payloads: List[str] = []

        if related_chunk_ids and self.qdrant_client:
            try:
                chunk_filter = qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="chunk_id",
                            match=qmodels.MatchAny(any=related_chunk_ids),
                        )
                    ]
                )
                payloads, _ = self.qdrant_client.scroll(
                    collection_name=self.collection_name,
                    scroll_filter=chunk_filter,
                    limit=len(related_chunk_ids),
                    with_vectors=False,
                    with_payload=True,
                )
                for item in payloads:
                    if item.payload and "content" in item.payload:
                        chunk_payloads.append(item.payload["content"])  # type: ignore[index]
            except Exception as exc:  # pragma: no cover - external dependency
                logger.warning("persona.insights.qdrant_failed", error=str(exc))

        graph_relationships: List[dict[str, Any]] = []
        if self.neo4j_driver:
            try:
                with self.neo4j_driver.session() as session:
                    result = session.run(
                        """
                        MATCH (p:Persona {id: $persona_id})-[r]->(n)
                        RETURN type(r) AS relationship, COLLECT(DISTINCT n.name)[0..5] AS nodes
                        LIMIT 5
                        """,
                        persona_id=str(persona.id),
                    )
                    for record in result:
                        graph_relationships.append(
                            {
                                "relationship": record.get("relationship"),
                                "nodes": record.get("nodes"),
                            }
                        )
            except Exception as exc:  # pragma: no cover - external dependency
                logger.warning("persona.insights.neo4j_failed", error=str(exc))

        if not related_chunk_ids and not graph_relationships:
            return None

        return PersonaInsight(
            relatedChunkIds=related_chunk_ids,
            graphRelationships=[
                {
                    "relationship": rel.get("relationship"),
                    "nodes": rel.get("nodes") or [],
                }
                for rel in graph_relationships
            ]
            or [],
        )


class PersonaService:
    def __init__(
        self,
        *,
        redis_client: Redis | None = None,
        insights_builder: PersonaInsightsBuilder | None = None,
    ) -> None:
        self._redis = redis_client or Redis.from_url(settings.redis_url)
        self._ttl = settings.persona_cache_ttl_seconds
        self._insights_builder = insights_builder or LivePersonaInsightsBuilder()
        self._storage = StorageService()

    # ----------------- Public API -----------------
    def list_personas(
        self,
        session: Session,
        *,
        allowed_project_ids: list[UUID] | None = None,
        project_id: str | None = None,
        target_group_id: str | None = None,
        status: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PersonaListResponse:
        query = select(Persona)
        if allowed_project_ids is not None:
            if not allowed_project_ids:
                return PersonaListResponse(items=[], total=0, page=page, page_size=page_size)
            query = query.where(Persona.project_id.in_(allowed_project_ids))
        if project_id:
            try:
                project_uuid = UUID(project_id)
            except ValueError as exc:
                raise ValueError("invalid_project_id") from exc
            if allowed_project_ids is not None and project_uuid not in allowed_project_ids:
                raise ValueError("project_access_denied")
            query = query.where(Persona.project_id == project_uuid)
        if target_group_id:
            try:
                query = query.where(Persona.target_group_id == UUID(target_group_id))
            except ValueError as exc:
                raise ValueError("invalid_target_group_id") from exc
        if status:
            try:
                persona_status = PersonaStatus(status)
                query = query.where(Persona.status == persona_status)
            except ValueError:
                logger.warning("persona.list.invalid_status", status=status)
        if search:
            like_pattern = f"%{search.lower()}%"
            query = query.where(func.lower(Persona.name).like(like_pattern))

        total = session.scalar(select(func.count()).select_from(query.subquery()))
        offset = (page - 1) * page_size
        personas = session.scalars(query.order_by(Persona.updated_at.desc()).offset(offset).limit(page_size)).all()

        items = [self._to_list_item(persona, session=session) for persona in personas]
        return PersonaListResponse(items=items, total=total or 0, page=page, page_size=page_size)

    def get_persona(self, session: Session, persona_id: str, *, use_cache: bool = True) -> PersonaResponse:
        if use_cache:
            cached = self._get_cached_response(persona_id)
            if cached:
                return cached

        persona = session.get(Persona, UUID(persona_id))
        if not persona:
            raise ValueError("persona_not_found")

        prompt = self._latest_prompt(session, persona.id)
        sources = session.scalars(select(PersonaSource).where(PersonaSource.persona_id == persona.id)).all()
        documents = self._documents_for_persona(session, persona.id)
        knowledge_entries = self._knowledge_for_persona(session, persona.id)
        insights = self._build_insights(persona, sources)
        response = self._build_response(
            persona,
            prompt,
            sources,
            documents=documents,
            knowledge=knowledge_entries,
            insights=insights,
        )
        self._set_cache(persona_id, response)
        return response

    def create_persona(self, session: Session, payload: PersonaCreateRequest) -> PersonaResponse:
        from .field_config import get_preserved_fields
        
        if payload.profile:
            # CRITICAL: Use model_dump(exclude_none=False) to preserve None values
            # And ensure preserved fields are always included
            profile_payload = payload.profile.model_dump(exclude_none=False, exclude_unset=False)
            
            # Ensure preserved fields are always present (even if None)
            preserve_fields = get_preserved_fields("persona", "profile")
            for field_name in preserve_fields:
                if field_name not in profile_payload:
                    # If field is not in profile_payload, check if it exists as attribute
                    if hasattr(payload.profile, field_name):
                        profile_payload[field_name] = getattr(payload.profile, field_name)
                    else:
                        profile_payload[field_name] = None
        else:
            profile_payload = self._default_profile_payload(
                name=payload.name,
                segment=payload.segment,
                headline=payload.headline,
            )
        target_group_id = None
        if payload.target_group_id:
            try:
                target_group_id = UUID(payload.target_group_id)
            except ValueError:
                raise ValueError("invalid_target_group_id")

        persona = Persona(
            project_id=UUID(payload.project_id),
            name=payload.name,
            segment=payload.segment,
            headline=_truncate_headline(payload.headline) or payload.headline,
            profile=profile_payload,
            confidence=payload.confidence,
            version=payload.version,
            status=PersonaStatus(payload.status) if payload.status else PersonaStatus.draft,
            updated_by=payload.updated_by,
            image_url=payload.image_url,
            target_group_id=target_group_id,
        )
        session.add(persona)
        session.flush()

        if payload.prompt:
            session.add(
                PersonaPromptModel(
                    persona_id=persona.id,
                    system_prompt=payload.prompt.systemPrompt,
                    template_version=payload.prompt.templateVersion,
                )
            )

        self._record_audit(
            session,
            persona=persona,
            action=PersonaAuditAction.created,
            actor=payload.updated_by or "system",
            before=None,
            after=self._audit_payload(persona),
        )
        session.commit()
        logger.info(
            "persona.create",
            persona_id=str(persona.id),
            project_id=str(persona.project_id),
            status=persona.status.value,
        )

        response = self._build_response(persona, self._latest_prompt(session, persona.id), [], documents=[], knowledge=[])
        self._set_cache(str(persona.id), response)
        return response

    def update_persona(self, session: Session, persona_id: str, payload: PersonaPatchRequest, profile_json: dict | None = None) -> PersonaResponse:
        from .generic_field_handler import GenericFieldHandler
        from .field_config import get_preserved_fields
        
        persona = session.get(Persona, UUID(persona_id))
        if not persona:
            raise ValueError("persona_not_found")

        before = self._audit_payload(persona)

        # Update simple fields
        if payload.name:
            persona.name = payload.name
        if payload.segment:
            persona.segment = payload.segment
        if payload.headline is not None:
            persona.headline = _truncate_headline(payload.headline) or payload.headline
        
        # Handle profile update - use raw JSON if available, otherwise Pydantic model
        if profile_json is not None:
            # DIRECT JSON APPROACH: Use raw JSON dict directly - no Pydantic filtering!
            from copy import deepcopy
            from sqlalchemy.orm.attributes import flag_modified
            
            preserve_fields = get_preserved_fields("persona", "profile")
            existing_profile = persona.profile or {}
            
            logger.info("persona.update.store.direct_json", persona_id=str(persona_id), profile_keys=list(profile_json.keys())[:30])
            logger.info(
                "persona.update.store.profile_values",
                persona_id=str(persona_id),
                gender_in=('gender' in profile_json),
                gender_value=profile_json.get('gender'),
                media_affinity_in=('media_affinity' in profile_json),
                media_affinity_value=profile_json.get('media_affinity'),
                age_in=('age' in profile_json),
                age_value=profile_json.get('age'),
            )
            
            # Merge: Start with existing, update with new JSON
            merged_profile = deepcopy(existing_profile)
            
            # Now update with new JSON (this may overwrite preserved fields, which is OK)
            merged_profile.update(profile_json)
            
            # CRITICAL: Ensure preserved_fields are ALWAYS present (even if None)
            # This MUST happen AFTER the merge to ensure all preserved fields are explicitly set
            for field_name in preserve_fields:
                if field_name in profile_json:
                    # Use value from JSON (can be None) - this explicitly sets it
                    merged_profile[field_name] = profile_json[field_name]
                elif field_name in existing_profile:
                    # Keep existing value if not in update
                    merged_profile[field_name] = existing_profile[field_name]
                else:
                    # If not in existing or JSON, explicitly set to None
                    merged_profile[field_name] = None
                
                logger.info(
                    "persona.update.store.set_preserved_field",
                    persona_id=str(persona_id),
                    field=field_name,
                    value=merged_profile.get(field_name),
                    in_json=(field_name in profile_json),
                    in_existing=(field_name in existing_profile),
                )
            
            logger.info(
                "persona.update.store.after_merge",
                persona_id=str(persona_id),
                merged_keys=list(merged_profile.keys())[:30],
                gender_in=('gender' in merged_profile),
                gender_value=merged_profile.get('gender'),
                media_affinity_in=('media_affinity' in merged_profile),
                media_affinity_value=merged_profile.get('media_affinity'),
            )
            
            # Direct assignment to persona.profile
            persona.profile = deepcopy(merged_profile)
            flag_modified(persona, "profile")
            
            logger.info(
                "persona.update.store.after_assignment",
                persona_id=str(persona_id),
                profile_keys=list((persona.profile or {}).keys())[:20],
                gender_in=('gender' in (persona.profile or {})),
                gender_value=(persona.profile or {}).get('gender'),
                media_affinity_in=('media_affinity' in (persona.profile or {})),
                media_affinity_value=(persona.profile or {}).get('media_affinity'),
            )
            
        elif payload.profile:
            # Fallback: Use Pydantic model (shouldn't happen with new approach)
            logger.warning("persona.update.using_pydantic_fallback", persona_id=str(persona_id))
            preserve_fields = get_preserved_fields("persona", "profile")
            handler = GenericFieldHandler(
                entity_type="persona",
                json_fields=["profile"],
                preserved_fields=preserve_fields,
            )
            profile_updates = payload.profile.model_dump(exclude_none=False, exclude_unset=False)
            for field_name in preserve_fields:
                if hasattr(payload.profile, field_name):
                    profile_updates[field_name] = getattr(payload.profile, field_name)
                elif field_name not in profile_updates:
                    profile_updates[field_name] = None
            handler.apply_updates_to_entity(
                persona,
                {"profile": profile_updates},
                json_field_preserve_fields={"profile": preserve_fields}
            )
        if payload.confidence is not None:
            persona.confidence = payload.confidence
        if payload.version:
            persona.version = payload.version
        if payload.status:
            try:
                persona.status = PersonaStatus(payload.status)
            except ValueError:
                logger.warning("persona.update.invalid_status", status=payload.status)
        if payload.last_reviewed_at:
            persona.last_reviewed_at = payload.last_reviewed_at
        if payload.image_url is not None:
            persona.image_url = payload.image_url
        if payload.locked_by is not None:
            persona.locked_by = payload.locked_by
        if payload.locked_at is not None:
            persona.locked_at = payload.locked_at

        persona.updated_by = payload.updated_by
        persona.updated_at = datetime.utcnow()

        if payload.prompt:
            session.add(
                PersonaPromptModel(
                    persona_id=persona.id,
                    system_prompt=payload.prompt.systemPrompt,
                    template_version=payload.prompt.templateVersion,
                )
            )

        self._record_audit(
            session,
            persona=persona,
            action=PersonaAuditAction.updated,
            actor=payload.updated_by or "system",
            before=before,
            after=self._audit_payload(persona),
        )
        session.commit()
        session.refresh(persona)
        
        # Debug: Log the actual saved profile data
        saved_profile = persona.profile or {}
        
        # CRITICAL: Verify that preserved fields are actually in the saved profile
        import json
        logger.info(
            "persona.update.store.after_commit",
            persona_id=str(persona.id),
            profile_keys=list(saved_profile.keys())[:30],
            gender_in=('gender' in saved_profile),
            gender_value=saved_profile.get('gender'),
            media_affinity_in=('media_affinity' in saved_profile),
            media_affinity_value=saved_profile.get('media_affinity'),
            age_in=('age' in saved_profile),
            age_value=saved_profile.get('age'),
        )
        
        # CRITICAL: Direct DB query to verify what's actually stored
        try:
            from sqlalchemy import text
            db_result = session.execute(
                text("SELECT profile::text FROM personas WHERE id = :persona_id"),
                {"persona_id": str(persona.id)}
            ).scalar()
            
            if db_result:
                db_profile = json.loads(db_result)
                logger.info(
                    "persona.update.store.db_query",
                    persona_id=str(persona.id),
                    db_profile_keys=list(db_profile.keys())[:30],
                    db_gender=db_profile.get('gender'),
                    db_media_affinity=db_profile.get('media_affinity'),
                    db_age=db_profile.get('age'),
                )
        except Exception as e:
            logger.warning("persona.update.store.db_query_error", persona_id=str(persona.id), error=str(e))
        
        logger.info(
            "persona.update",
            persona_id=str(persona.id),
            status=persona.status.value,
            updated_by=persona.updated_by,
            saved_profile_keys=list(saved_profile.keys())[:20],
            saved_gender=saved_profile.get("gender"),
            saved_age=saved_profile.get("age"),
            saved_location=saved_profile.get("location"),
            saved_media_affinity=saved_profile.get("media_affinity"),
        )

        prompt = self._latest_prompt(session, persona.id)
        sources = session.scalars(select(PersonaSource).where(PersonaSource.persona_id == persona.id)).all()
        documents = self._documents_for_persona(session, persona.id)
        knowledge_entries = self._knowledge_for_persona(session, persona.id)
        insights = self._build_insights(persona, sources)
        response = self._build_response(
            persona,
            prompt,
            sources,
            documents=documents,
            knowledge=knowledge_entries,
            insights=insights,
        )
        self._invalidate_cache(str(persona.id))
        self._set_cache(str(persona.id), response)
        return response

    def archive_persona(self, session: Session, persona_id: str, actor: str | None = None) -> None:
        persona = session.get(Persona, UUID(persona_id))
        if not persona:
            raise ValueError("persona_not_found")
        before = self._audit_payload(persona)
        persona.status = PersonaStatus.archived
        persona.updated_at = datetime.utcnow()
        persona.updated_by = actor
        self._record_audit(
            session,
            persona=persona,
            action=PersonaAuditAction.archived,
            actor=actor or "system",
            before=before,
            after=self._audit_payload(persona),
        )
        session.commit()
        self._invalidate_cache(persona_id)
        logger.info(
            "persona.archive",
            persona_id=persona_id,
            actor=actor,
        )

    def delete_persona(self, session: Session, persona_id: str, actor: str | None = None) -> None:
        """Permanently delete a persona and all associated data."""
        persona = session.get(Persona, UUID(persona_id))
        if not persona:
            raise ValueError("persona_not_found")
        
        persona_uuid = persona.id
        before = self._audit_payload(persona)
        
        # Delete all associated documents (this will also delete chunks, processing jobs, etc.)
        from ..models import Document, DocumentChunk, ProcessingJob
        documents = session.scalars(select(Document).where(Document.persona_id == persona_uuid)).all()
        for document in documents:
            # Delete file from storage
            if document.object_key:
                try:
                    self._storage.delete(key=document.object_key)
                except Exception:
                    logger.warning("persona.delete.storage_failed", key=document.object_key, error=str(e))
            
            # Delete chunks from Qdrant
            try:
                from qdrant_client.http import models as qmodels
                qdrant = QdrantClient(settings.qdrant_url)
                collection = "research_chunks"
                if qdrant.collection_exists(collection):
                    qdrant.delete(
                        collection_name=collection,
                        points_selector=qmodels.Filter(
                            must=[
                                qmodels.FieldCondition(
                                    key="document_id",
                                    match=qmodels.MatchValue(value=str(document.id)),
                                )
                            ]
                        ),
                    )
            except Exception:
                logger.warning("persona.delete.qdrant_failed", document_id=str(document.id), error=str(e))
            
            # Delete chunks from database
            session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
            
            # Delete processing job
            session.execute(delete(ProcessingJob).where(ProcessingJob.document_id == document.id))
            
            # Delete document
            session.delete(document)
        
        # Delete all knowledge entries
        from ..models import PersonaKnowledgeEntry, PersonaSource, PersonaPrompt as PersonaPromptModel, PersonaAuditLog
        session.execute(delete(PersonaKnowledgeEntry).where(PersonaKnowledgeEntry.persona_id == persona_uuid))
        
        # Delete all persona sources
        session.execute(delete(PersonaSource).where(PersonaSource.persona_id == persona_uuid))
        
        # Delete all persona prompts
        session.execute(delete(PersonaPromptModel).where(PersonaPromptModel.persona_id == persona_uuid))
        
        # Delete all audit logs before deleting persona (to avoid foreign key constraint violation)
        # Note: We delete audit logs because the persona is being permanently deleted
        # We log the deletion action before deleting the logs
        logger.info(
            "persona.delete.audit_logs",
            persona_id=persona_id,
            actor=actor,
            before=before,
        )
        session.execute(delete(PersonaAuditLog).where(PersonaAuditLog.persona_id == persona_uuid))
        
        # Delete avatar from storage if it exists
        if persona.image_url and not persona.image_url.startswith(("http://", "https://", "data:")):
            try:
                self._storage.delete(key=persona.image_url)
            except Exception:
                logger.warning("persona.delete.avatar_failed", key=persona.image_url, error=str(e))
        
        # Finally, delete the persona itself
        session.delete(persona)
        session.commit()
        
        # Invalidate cache
        self._invalidate_cache(persona_id)
        
        logger.info(
            "persona.delete",
            persona_id=persona_id,
            actor=actor,
        )

    def list_documents(self, session: Session, persona_id: str) -> List[PersonaDocument]:
        try:
            persona_uuid = UUID(persona_id)
        except ValueError as exc:
            raise ValueError("invalid_persona_id") from exc
        return self._documents_for_persona(session, persona_uuid)

    def list_knowledge(self, session: Session, persona_id: str) -> List[PersonaKnowledgeEntrySchema]:
        try:
            persona_uuid = UUID(persona_id)
        except ValueError as exc:
            raise ValueError("invalid_persona_id") from exc
        return self._knowledge_for_persona(session, persona_uuid)

    def serialize_document(self, document: Document, session: Session | None = None) -> PersonaDocument:
        return self._to_document_payload(document, session=session)

    def serialize_knowledge_entry(self, entry: PersonaKnowledgeEntry) -> PersonaKnowledgeEntrySchema:
        return PersonaKnowledgeEntrySchema(
            id=str(entry.id),
            personaId=str(entry.persona_id),
            title=entry.title,
            content=entry.content,
            metadata=entry.metadata_payload or {},
            createdBy=entry.created_by,
            createdAt=entry.created_at,
        )

    def invalidate_cache(self, persona_id: str) -> None:
        self._invalidate_cache(persona_id)

    # ----------------- Helpers -----------------
    def _build_response(
        self,
        persona: Persona,
        prompt_model: PersonaPromptModel | None,
        sources: List[PersonaSource],
        *,
        documents: List[PersonaDocument] | None = None,
        knowledge: List[PersonaKnowledgeEntrySchema] | None = None,
        profile_override: PersonaProfile | None = None,
        insights: PersonaInsight | None = None,
    ) -> PersonaResponse:
        profile = profile_override or self._profile_from_persona(persona)
        if prompt_model:
            prompt = PersonaPrompt(
                persona_id=str(persona.id),
                system_prompt=prompt_model.system_prompt,
                template_version=prompt_model.template_version,
            )
        else:
            prompt = PersonaPrompt(persona_id=str(persona.id), system_prompt="", template_version="unknown")
        sources_payload = [
            {
                "chunk_id": str(source.chunk_id),
                "confidence": source.confidence,
                "rationale": source.rationale,
            }
            for source in sources
        ]

        metadata = PersonaMetadata(
            personaId=str(persona.id),
            projectId=str(persona.project_id),
            status=persona.status.value,
            version=persona.version,
            confidence=persona.confidence,
            updatedAt=persona.updated_at or persona.created_at,
            updatedBy=persona.updated_by,
            lastReviewedAt=persona.last_reviewed_at,
            imageUrl=None,
            avatarUrl=self._avatar_url(persona),
            lockedBy=persona.locked_by,
            lockedAt=persona.locked_at,
            consoleUrl=self._console_url(persona.id),
            graphUrl=self._graph_url(persona.id),
            graphBloomUrl=self._graph_bloom_url(persona.id),
        )

        return PersonaResponse(
            profile=profile,
            prompt=prompt,
            sources=sources_payload,
            metadata=metadata,
            documents=documents or [],
            knowledge=knowledge or [],
            insights=insights,
        )

    def _profile_from_persona(self, persona: Persona) -> PersonaProfile:
        from .field_config import get_preserved_fields
        
        payload = persona.profile or {}
        preserve_fields = get_preserved_fields("persona", "profile")

        def field(*keys: str, default: Any = None) -> Any:
            for key in keys:
                if key in payload and payload[key] is not None:
                    return payload[key]
            return default

        defaults = {
            "id": str(persona.id),
            "name": field("name", default=persona.name),
            "segment": field("segment", default=persona.segment),
            "headline": field("headline", default=persona.headline),
            "bio": field("bio", default=""),
            "traits": field("traits", default={}),
            "pain_points": field("pain_points", "painPoints", default=[]),
            "goals": field("goals", default=[]),
            "communication_style": field("communication_style", "communicationStyle", default=self._default_comm_style()),
            "confidence": field("confidence", default=persona.confidence),
            "version": field("version", default=persona.version),
            "created_at": field("created_at", "createdAt", default=(persona.created_at or datetime.utcnow()).isoformat()),
            # Optional fields
            "interests": payload.get("interests", []),
            "color_palette": payload.get("color_palette", []),
            "attention_span": payload.get("attention_span") if "attention_span" in payload else None,
            "social_media_usage": payload.get("social_media_usage", []),
            "values": payload.get("values", []),
        }
        
        # CRITICAL: Preserved fields - always include them explicitly, even if None
        # This ensures they're available for editing and are included in API responses
        for field_name in preserve_fields:
            # Explicitly check if key exists in payload (to distinguish None from missing)
            if field_name in payload:
                defaults[field_name] = payload[field_name]  # Can be None
            else:
                defaults[field_name] = None  # Explicitly None if not present
        
        # Helper to normalize items to objects if they are strings (legacy data support)
        def normalize_goals(items: List[Any]) -> List[Dict[str, Any]]:
            normalized = []
            for item in items:
                if isinstance(item, str):
                    normalized.append({"label": item, "priority": 1})
                elif isinstance(item, dict):
                    normalized.append(item)
            return normalized

        def normalize_pain_points(items: List[Any]) -> List[Dict[str, Any]]:
            normalized = []
            for item in items:
                if isinstance(item, str):
                    normalized.append({"label": item, "evidence_count": 1})
                elif isinstance(item, dict):
                    normalized.append(item)
            return normalized

        # Apply normalization to potentially legacy fields
        defaults["goals"] = normalize_goals(defaults["goals"])
        defaults["pain_points"] = normalize_pain_points(defaults["pain_points"])
        
        # Create PersonaProfile instance
        profile = PersonaProfile(**defaults)
        
        # CRITICAL: Explicitly set preserved demographic fields to ensure they're included even if None
        # Pydantic will include them in model_dump() when they're explicitly set as attributes
        for field_name in preserve_fields:
            setattr(profile, field_name, defaults.get(field_name))
        
        return profile

    def _default_profile_payload(self, *, name: str, segment: str, headline: str) -> dict[str, Any]:
        from .field_config import get_preserved_fields
        
        now = datetime.utcnow().isoformat()
        preserve_fields = get_preserved_fields("persona", "profile")
        
        payload = {
            "name": name,
            "segment": segment,
            "headline": headline,
            "bio": "",
            "traits": {},
            "pain_points": [],
            "painPoints": [],
            "goals": [],
            "communication_style": self._default_comm_style(),
            "communicationStyle": self._default_comm_style(),
            "confidence": 0.7,
            "version": "1.0.0",
            "created_at": now,
            "createdAt": now,
        }
        
        # CRITICAL: Add preserved fields explicitly as None
        # This ensures they're always present in the profile from the start
        for field_name in preserve_fields:
            payload[field_name] = None
        
        return payload

    def _default_comm_style(self) -> dict[str, Any]:
        return {
            "vocabulary": [],
            "sentence_structure": "",
            "skepticism_level": 0,
        }

    def _latest_prompt(self, session: Session, persona_id: UUID) -> PersonaPromptModel | None:
        return session.scalar(
            select(PersonaPromptModel)
            .where(PersonaPromptModel.persona_id == persona_id)
            .order_by(PersonaPromptModel.created_at.desc())
        )

    def _build_insights(self, persona: Persona, sources: List[PersonaSource]) -> PersonaInsight | None:
        if not self._insights_builder:
            return None
        return self._insights_builder.build(persona=persona, sources=sources)

    def _console_url(self, persona_id: UUID) -> str:
        base = settings.persona_console_base_url.rstrip("/")
        path = settings.persona_media_base_path.strip("/")
        return f"{base}/{path}/{persona_id}"

    def _graph_url(self, persona_id: UUID) -> str | None:
        browser = (settings.neo4j_browser_url or "").strip()
        if not browser:
            return None
        base = browser.rstrip("/")
        return f"{base}?query=MATCH%20(p:Persona%20{{id:%20%27{persona_id}%27}})%20RETURN%20p"

    def _graph_bloom_url(self, persona_id: UUID) -> str | None:
        bloom = (settings.neo4j_bloom_url or "").strip()
        if not bloom:
            return None
        base = bloom.rstrip("/")
        return f"{base}?personaId={persona_id}"

    def _public_base(self) -> str:
        return settings.persona_backend_public_url.rstrip("/")

    def _documents_for_persona(self, session: Session, persona_id: UUID) -> List[PersonaDocument]:
        records = session.scalars(
            select(Document)
            .where(Document.persona_id == persona_id)
            .order_by(Document.created_at.desc())
        ).all()
        return [self._to_document_payload(record, session=session) for record in records]

    def _knowledge_for_persona(self, session: Session, persona_id: UUID) -> List[PersonaKnowledgeEntrySchema]:
        # Get persona to check for target_group_id
        persona = session.get(Persona, persona_id)
        if not persona:
            return []
        
        # If persona has target_group_id, also include target group knowledge
        knowledge_entries = []
        
        # Get persona-specific knowledge
        entries = session.scalars(
            select(PersonaKnowledgeEntry)
            .where(PersonaKnowledgeEntry.persona_id == persona_id)
            .order_by(PersonaKnowledgeEntry.created_at.desc())
        ).all()
        knowledge_entries.extend([self.serialize_knowledge_entry(entry) for entry in entries])
        
        # If target_group_id exists, also get target group knowledge
        if persona.target_group_id:
            from ..models import TargetGroupKnowledgeEntry
            tg_entries = session.scalars(
                select(TargetGroupKnowledgeEntry)
                .where(TargetGroupKnowledgeEntry.target_group_id == persona.target_group_id)
                .order_by(TargetGroupKnowledgeEntry.created_at.desc())
            ).all()
            # Serialize target group knowledge entries using the same format
            for tg_entry in tg_entries:
                knowledge_entries.append(
                    PersonaKnowledgeEntrySchema(
                        id=str(tg_entry.id),
                        personaId=str(persona_id),  # Keep persona_id for compatibility
                        title=tg_entry.title,
                        content=tg_entry.content,
                        metadata=tg_entry.metadata_payload,
                        createdBy=tg_entry.created_by,
                        createdAt=tg_entry.created_at,
                    )
                )
        
        return knowledge_entries

    def _to_document_payload(self, document: Document, session: Session | None = None) -> PersonaDocument:
        ingestion_status = None
        ingestion_progress = None
        
        # Load ProcessingJob if session is available
        if session:
            from ..models import ProcessingJob
            job = session.scalar(
                select(ProcessingJob)
                .where(ProcessingJob.document_id == document.id)
                .order_by(ProcessingJob.created_at.desc())
            )
            if job:
                ingestion_status = job.status
                ingestion_progress = job.progress
        
        return PersonaDocument(
            id=str(document.id),
            filename=document.filename,
            contentType=document.content_type,
            sizeBytes=document.size_bytes,
            uploadedAt=document.created_at or datetime.utcnow(),
            uploadedBy=document.uploaded_by,
            downloadUrl=f"{self._public_base()}/personas/{document.persona_id}/documents/{document.id}/download",
            insightSummary=document.insight_summary,
            ingestionStatus=ingestion_status,
            ingestionProgress=ingestion_progress,
        )

    def _avatar_url(self, persona: Persona) -> str | None:
        if not persona.image_url:
            return None
        if persona.image_url.startswith("https://"):
            return persona.image_url
        return f"{self._public_base()}/personas/{persona.id}/avatar"

    def _to_list_item(self, persona: Persona, session: Session | None = None) -> PersonaListItem:
        # Convert profile to PersonaProfile if available
        profile_data = None
        if persona.profile and isinstance(persona.profile, dict):
            try:
                profile_data = PersonaProfile(**persona.profile)
            except Exception as e:
                # If profile doesn't match PersonaProfile schema, try to create a minimal profile
                # Log the error for debugging
                logger.warning(
                    "persona.list.profile_conversion_failed",
                    persona_id=str(persona.id),
                    error=str(e),
                    profile_keys=list(persona.profile.keys())[:10] if isinstance(persona.profile, dict) else None
                )
                # Try to create a basic profile from the raw data
                try:
                    # Extract basic fields that should always be available
                    profile_data = PersonaProfile(
                        id=str(persona.id),
                        name=persona.profile.get("name") or persona.name,
                        segment=persona.profile.get("segment") or persona.segment,
                        headline=persona.profile.get("headline") or persona.headline,
                        bio=persona.profile.get("bio", ""),
                        traits=persona.profile.get("traits", {}),
                        pain_points=persona.profile.get("pain_points") or persona.profile.get("painPoints", []),
                        goals=persona.profile.get("goals", []),
                        communication_style=persona.profile.get("communication_style") or persona.profile.get("communicationStyle", {}),
                        confidence=persona.profile.get("confidence", persona.confidence),
                        version=persona.profile.get("version", persona.version),
                        interests=persona.profile.get("interests", []),
                        color_palette=persona.profile.get("color_palette") or persona.profile.get("colorPalette", []),
                        attention_span=persona.profile.get("attention_span") or persona.profile.get("attentionSpan"),
                        social_media_usage=persona.profile.get("social_media_usage") or persona.profile.get("socialMediaUsage", []),
                        values=persona.profile.get("values", []),
                        # Include optional demographics fields
                        full_name=persona.profile.get("full_name") or persona.profile.get("fullName"),
                        age=persona.profile.get("age"),
                        location=persona.profile.get("location"),
                        gender=persona.profile.get("gender"),
                        media_affinity=persona.profile.get("media_affinity") or persona.profile.get("mediaAffinity"),
                    )
                except Exception as e2:
                    logger.warning(
                        "persona.list.profile_fallback_failed",
                        persona_id=str(persona.id),
                        error=str(e2)
                    )
                    # Last resort: return None, but this shouldn't happen
                    profile_data = None
        
        # Load system prompt if session is available
        prompt_data = None
        if session:
            prompt_model = self._latest_prompt(session, persona.id)
            if prompt_model:
                from msqdx_glass_proto.personas import PersonaPrompt
                prompt_data = PersonaPrompt(
                    persona_id=str(persona.id),
                    system_prompt=prompt_model.system_prompt,
                    template_version=prompt_model.template_version,
                )
        
        return PersonaListItem(
            id=str(persona.id),
            projectId=str(persona.project_id),
            name=persona.name,
            segment=persona.segment,
            headline=persona.headline,
            status=persona.status.value,
            confidence=persona.confidence,
            version=persona.version,
            updatedAt=persona.updated_at or persona.created_at,
            updatedBy=persona.updated_by,
            imageUrl=persona.image_url if persona.image_url and persona.image_url.startswith(("http://", "https://")) else None,
            avatarUrl=self._avatar_url(persona),
            profileCard=persona.profile_card,
            profile=profile_data,
            prompt=prompt_data,
        )

    def _audit_payload(self, persona: Persona) -> dict[str, Any]:
        return {
            "name": persona.name,
            "segment": persona.segment,
            "headline": persona.headline,
            "profile": persona.profile,
            "confidence": persona.confidence,
            "version": persona.version,
            "status": persona.status.value,
            "updated_by": persona.updated_by,
            "image_url": persona.image_url,
        }

    def _record_audit(
        self,
        session: Session,
        *,
        persona: Persona,
        action: PersonaAuditAction,
        actor: str,
        before: dict[str, Any] | None,
        after: dict[str, Any] | None,
    ) -> None:
        session.add(
            PersonaAuditLog(
                persona_id=persona.id,
                action=action,
                actor=actor,
                payload_before=before,
                payload_after=after,
            )
        )

    # ----------------- Cache helpers -----------------
    def _cache_key(self, persona_id: str) -> str:
        return f"persona:detail:{persona_id}"

    def _get_cached_response(self, persona_id: str) -> PersonaResponse | None:
        try:
            cached = self._redis.get(self._cache_key(persona_id))
            if not cached:
                return None
            return PersonaResponse(**orjson.loads(cached))
        except Exception as exc:
            logger.warning("persona.cache.get_failed", error=str(exc))
            return None

    def _set_cache(self, persona_id: str, response: PersonaResponse) -> None:
        try:
            self._redis.setex(
                self._cache_key(persona_id),
                self._ttl,
                orjson.dumps(response.model_dump(mode="json")),
            )
        except Exception as exc:
            logger.warning("persona.cache.set_failed", error=str(exc))

    def _invalidate_cache(self, persona_id: str) -> None:
        try:
            self._redis.delete(self._cache_key(persona_id))
        except Exception as exc:
            logger.warning("persona.cache.delete_failed", error=str(exc))
