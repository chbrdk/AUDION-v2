from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from ..db import get_session
from ..models import DocumentChunk, Persona, PersonaPrompt, PersonaSource
from ..services.persona_generation import PersonaGenerationService
from ..services.persona_image import PersonaImageService
from udg_glass_proto import PersonaProfile

router = APIRouter(prefix="/personas", tags=["personas"])


class CreatePersonaRequest(BaseModel):
    name: str
    segment: str
    headline: str
    chunk_ids: list[str]  # List of chunk UUIDs to base the persona on
    project_id: str | None = None  # Optional project ID


class PersonaProfileCard(BaseModel):
    display_name: str | None = None
    headline: str | None = None
    archetype: str | None = None
    tone: str | None = None
    age_range: str | None = None
    location: str | None = None
    tagline: str | None = None
    key_facts: list[str] | None = None
    goals: list[str] | None = None
    frustrations: list[str] | None = None
    preferred_channels: list[str] | None = None
    call_to_action: str | None = None


class PersonaResponse(BaseModel):
    id: str
    name: str
    segment: str
    headline: str
    confidence: float
    created_at: str
    image_url: str | None = None
    profile_card: PersonaProfileCard | None = None
    profile: dict | None = None


@router.post("/", response_model=PersonaResponse)
def create_persona(request: CreatePersonaRequest) -> PersonaResponse:
    """Create a new persona from research chunks."""
    try:
        # Convert chunk IDs to UUIDs
        chunk_uuids = [UUID(chunk_id) for chunk_id in request.chunk_ids]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid chunk ID format: {e}") from e

    # Verify chunks exist
    with get_session() as session:
        chunks = session.scalars(
            select(DocumentChunk).where(DocumentChunk.id.in_(chunk_uuids))
        ).all()
        
        if len(chunks) != len(chunk_uuids):
            found_ids = {str(chunk.id) for chunk in chunks}
            missing = set(request.chunk_ids) - found_ids
            raise HTTPException(
                status_code=404,
                detail=f"Chunks not found: {', '.join(missing)}"
            )

    # Create persona
    project_id = UUID(request.project_id) if request.project_id else uuid4()
    persona = Persona(
        id=uuid4(),
        project_id=project_id,
        name=request.name,
        segment=request.segment,
        headline=request.headline,
        profile={},  # Will be filled by generation service
        confidence=0.8,  # Default confidence
        version="1.0.0",
    )

    with get_session() as session:
        session.add(persona)
        session.commit()
        session.refresh(persona)

    # Generate detailed persona profile
    try:
        generation_service = PersonaGenerationService()
        result = generation_service.generate(persona=persona, chunk_ids=chunk_uuids)
    except Exception as e:
        # If generation fails, still return the basic persona
        import structlog
        logger = structlog.get_logger(__name__)
        logger.warning("persona.generation.failed", error=str(e), persona_id=str(persona.id))

    return PersonaResponse(
        id=str(persona.id),
        name=persona.name,
        segment=persona.segment,
        headline=persona.headline,
        confidence=persona.confidence,
        created_at=persona.created_at.isoformat(),
        image_url=persona.image_url,
        profile_card=persona.profile_card,
        profile=persona.profile,
    )


@router.get("/", response_model=list[PersonaResponse])
def list_personas(project_id: str | None = None) -> list[PersonaResponse]:
    """List all personas, optionally filtered by project_id."""
    with get_session() as session:
        query = select(Persona)
        if project_id:
            query = query.where(Persona.project_id == UUID(project_id))
        personas = session.scalars(query).all()
        
        return [
            PersonaResponse(
                id=str(p.id),
                name=p.name,
                segment=p.segment,
                headline=p.headline,
                confidence=p.confidence,
                created_at=p.created_at.isoformat(),
                image_url=p.image_url,
                profile_card=p.profile_card,
                profile=p.profile,
            )
            for p in personas
        ]


@router.get("/{persona_id}", response_model=PersonaResponse)
def get_persona(persona_id: str) -> PersonaResponse:
    """Get a persona by ID."""
    try:
        persona_uuid = UUID(persona_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid persona ID format: {e}") from e

    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona:
            raise HTTPException(status_code=404, detail="Persona not found")
        
        return PersonaResponse(
            id=str(persona.id),
            name=persona.name,
            segment=persona.segment,
            headline=persona.headline,
            confidence=persona.confidence,
            created_at=persona.created_at.isoformat(),
            image_url=persona.image_url,
            profile_card=persona.profile_card,
            profile=persona.profile,
        )


class GenerateImageResponse(BaseModel):
    image_url: str | None
    status: str


class ProfileCardRegenerateResponse(BaseModel):
    profile_card: PersonaProfileCard | None


@router.post("/{persona_id}/generate-image", response_model=GenerateImageResponse)
def generate_persona_image(persona_id: str) -> GenerateImageResponse:
    """Generate an image for an existing persona."""
    try:
        persona_uuid = UUID(persona_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid persona ID format: {e}") from e

    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona:
            raise HTTPException(status_code=404, detail="Persona not found")
        
        # Convert persona to PersonaProfile
        profile_dict = persona.profile if isinstance(persona.profile, dict) else {}
        profile = PersonaProfile(
            id=str(persona.id),
            name=persona.name,
            segment=persona.segment,
            headline=persona.headline,
            bio=profile_dict.get("bio", ""),
            traits=profile_dict.get("traits", {}),
            pain_points=profile_dict.get("pain_points", []),
            goals=profile_dict.get("goals", []),
            communication_style=profile_dict.get("communication_style", {}),
            confidence=persona.confidence,
            version=persona.version,
            created_at=persona.created_at.isoformat(),
        )
    
    # Generate image
    image_service = PersonaImageService()
    image_url = image_service.generate_portrait(profile, save_to_storage=True)
    
    # Update persona with image URL
    if image_url:
        from datetime import datetime
        with get_session() as session:
            persona = session.get(Persona, persona_uuid)
            if persona:
                persona.image_url = image_url
                persona.image_generated_at = datetime.utcnow()
                session.commit()
    
    return GenerateImageResponse(
        image_url=image_url,
        status="success" if image_url else "failed"
    )


@router.post("/{persona_id}/profile-card/regenerate", response_model=ProfileCardRegenerateResponse)
def regenerate_profile_card(persona_id: str) -> ProfileCardRegenerateResponse:
    """Regenerate the lightweight persona profile card summary."""
    try:
        persona_uuid = UUID(persona_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid persona ID format: {e}") from e

    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona:
            raise HTTPException(status_code=404, detail="Persona not found")
        if not persona.profile:
            raise HTTPException(status_code=400, detail="Persona profile missing; regenerate persona first.")

        generation_service = PersonaGenerationService()
        try:
            profile_card = generation_service.generate_profile_card_from_persona(persona)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to regenerate profile card: {exc}") from exc

        persona.profile_card = profile_card
        session.commit()

    return ProfileCardRegenerateResponse(profile_card=profile_card)

