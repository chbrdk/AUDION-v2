from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Persona, PersonaPrompt as PersonaPromptModel, PersonaSource
from ..schemas import PersonaGenerateRequest, PersonaResponse
from ..services.persona_generation import PersonaGenerationService

router = APIRouter(prefix="/personas", tags=["personas"])
generator = PersonaGenerationService()


def get_db():
    with get_session() as session:
        yield session


@router.post("/generate", response_model=PersonaResponse)
def generate_persona(payload: PersonaGenerateRequest, session: Session = Depends(get_db)) -> PersonaResponse:
    persona = Persona(
        project_id=UUID(payload.project_id),
        name="Pending Persona",
        segment=payload.segment,
        headline="Auto-generated persona",
        profile={},
        confidence=0.7,
        version="1.0.0",
    )
    session.add(persona)
    session.commit()

    # In real pipeline chunk IDs would come from discovery stage
    chunk_ids: List[UUID] = []
    result = generator.generate(persona=persona, chunk_ids=chunk_ids)

    return PersonaResponse(profile=result.profile, prompt=result.prompt, sources=result.sources)


@router.get("/{persona_id}", response_model=PersonaResponse)
def get_persona(persona_id: str, session: Session = Depends(get_db)) -> PersonaResponse:
    persona = session.get(Persona, UUID(persona_id))
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    prompt = (
        session.query(PersonaPromptModel).filter(PersonaPromptModel.persona_id == persona.id).order_by(PersonaPromptModel.created_at.desc()).first()
    )
    sources = (
        session.query(PersonaSource).filter(PersonaSource.persona_id == persona.id).all()
    )
    return PersonaResponse(
        profile=persona.profile,
        prompt={
            "personaId": str(persona.id),
            "systemPrompt": prompt.system_prompt if prompt else "",
            "templateVersion": prompt.template_version if prompt else "unknown",
        },
        sources=[
            {
                "chunk_id": str(source.chunk_id),
                "confidence": source.confidence,
                "rationale": source.rationale,
            }
            for source in sources
        ],
    )

