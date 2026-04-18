"""Shared persona creation + generation for target groups (easy-setup and API routes)."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from ..models import Persona, TargetGroup
from ..schemas import PersonaResponse
from .persona_generation import PersonaGenerationService
from .persona_store import PersonaService, _truncate_headline

persona_service = PersonaService()
persona_generator = PersonaGenerationService()


def generate_persona_for_target_group(
    session: Session,
    *,
    target_group: TargetGroup,
    segment: str,
    description: str | None,
    filter_mode: str = "auto",
    document_ids: list[UUID] | None = None,
    chunk_ids: list[UUID] | None = None,
    chunk_weights: dict[str, float] | None = None,
    limit_chunks: int | None = None,
    variation_params: dict | None = None,
    output_locale: str | None = None,
) -> PersonaResponse:
    """
    Create a Persona row, run synchronous generation, rollback persona on failure.
    Caller must commit outer transaction if this is part of a larger unit of work.
    """
    _headline = description or f"Auto-generated persona for {target_group.name}"
    persona = Persona(
        project_id=target_group.project_id,
        name="Pending Persona",
        segment=segment,
        headline=_truncate_headline(_headline) or _headline,
        profile={},
        confidence=0.7,
        version="1.0.0",
        target_group_id=target_group.id,
    )
    session.add(persona)
    session.commit()
    session.refresh(persona)

    final_chunk_ids = chunk_ids if filter_mode == "chunks_manual" else None
    final_document_ids = document_ids if filter_mode == "documents" else None

    try:
        persona_generator.generate(
            persona=persona,
            target_group_id=target_group.id,
            document_ids=final_document_ids,
            chunk_ids=final_chunk_ids,
            chunk_weights=chunk_weights,
            limit_chunks=limit_chunks if filter_mode != "chunks_manual" else None,
            variation_params=variation_params,
            output_locale=output_locale,
        )
    except Exception:
        session.delete(persona)
        session.commit()
        raise

    session.refresh(persona)
    return persona_service.get_persona(session, str(persona.id), use_cache=False)
