from __future__ import annotations

from datetime import datetime

import structlog
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from uuid import UUID

from ..core.config import get_settings
from ..db import get_session
from ..models import Persona, PersonaPrompt
from ..schemas import AiTemplateDefinition, AiTemplateSummary, AiTemplateUpdateRequest
from ..services.ai_assist import PromptTemplateRegistry

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])
registry = PromptTemplateRegistry()


@router.get("/ai/providers")
def list_ai_providers() -> dict:
    settings = get_settings()
    providers = [
        {
            "id": "anthropic",
            "label": "Anthropic Claude",
            "model": settings.ai_anthropic_model,
            "api_key_configured": bool(settings.claude_api_key),
        },
        {
            "id": "openai",
            "label": "OpenAI GPT",
            "model": settings.ai_openai_model,
            "api_key_configured": bool(settings.openai_api_key),
        },
    ]
    return {
        "default_provider": settings.ai_default_provider,
        "providers": providers,
    }


@router.get("/ai/templates", response_model=list[AiTemplateSummary])
def list_ai_templates() -> list[AiTemplateSummary]:
    return registry.list_templates()


@router.get("/ai/templates/{template_id}", response_model=AiTemplateDefinition)
def get_ai_template(template_id: str) -> AiTemplateDefinition:
    """Get full template definition including prompt and output config."""
    try:
        return registry.get_full_template(template_id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/ai/templates/{template_id}", response_model=AiTemplateDefinition)
def update_ai_template(template_id: str, payload: AiTemplateUpdateRequest) -> AiTemplateDefinition:
    """Update a template's metadata, prompt, or configuration."""
    try:
        # Convert Pydantic model to dict, excluding None values
        updates = payload.model_dump(exclude_unset=True, exclude_none=False)
        # Remove None values manually to allow partial updates
        updates = {k: v for k, v in updates.items() if v is not None}
        
        if not updates:
            # No updates provided, return current template
            return registry.get_full_template(template_id)
        
        return registry.update_template(template_id, updates)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("settings.template.update_failed", template_id=template_id, error=str(exc), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update template: {str(exc)}",
        ) from exc


@router.get("/ai/persona-prompts")
def list_persona_prompts() -> list[dict]:
    """List all persona prompts as template-like entries."""
    with get_session() as session:
        # Get all personas with their prompts
        personas = session.query(Persona).all()
        prompts = []
        
        for persona in personas:
            prompt = session.scalar(
                select(PersonaPrompt)
                .where(PersonaPrompt.persona_id == persona.id)
                .order_by(PersonaPrompt.created_at.desc())
            )
            
            if prompt:
                prompts.append({
                    "template_id": f"persona-prompt-{persona.id}",
                    "label": f"{persona.name} - System Prompt",
                    "description": f"System prompt for persona: {persona.name}",
                    "category": "Persona Prompts",
                    "tags": ["persona", "chat", "system-prompt"],
                    "default_provider": "anthropic",
                    "default_model": "claude-3-5-haiku-20241022",
                    "persona_id": str(persona.id),
                    "persona_name": persona.name,
                })
        
        return prompts


@router.get("/ai/persona-prompts/{persona_id}", response_model=AiTemplateDefinition)
def get_persona_prompt(persona_id: str) -> AiTemplateDefinition:
    """Get persona prompt as a template definition."""
    try:
        persona_uuid = UUID(persona_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid persona_id format: {exc}"
        ) from exc
    
    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Persona not found: {persona_id}"
            )
        
        prompt = session.scalar(
            select(PersonaPrompt)
            .where(PersonaPrompt.persona_id == persona_uuid)
            .order_by(PersonaPrompt.created_at.desc())
        )
        
        if not prompt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prompt not found for persona: {persona_id}"
            )
        
        return AiTemplateDefinition(
            template_id=f"persona-prompt-{persona.id}",
            label=f"{persona.name} - System Prompt",
            description=f"System prompt for persona: {persona.name}",
            category="Persona Prompts",
            tags=["persona", "chat", "system-prompt"],
            default_provider="anthropic",
            default_model="claude-3-5-haiku-20241022",
            temperature=0.4,
            max_tokens=600,
            prompt=prompt.system_prompt,
            output={"mode": "text"},
            metadata={
                "persona_id": str(persona.id),
                "persona_name": persona.name,
                "template_version": prompt.template_version,
            }
        )


@router.put("/ai/persona-prompts/{persona_id}", response_model=AiTemplateDefinition)
def update_persona_prompt(persona_id: str, payload: AiTemplateUpdateRequest) -> AiTemplateDefinition:
    """Update a persona prompt."""
    try:
        persona_uuid = UUID(persona_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid persona_id format: {exc}"
        ) from exc
    
    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Persona not found: {persona_id}"
            )
        
        # Get or create prompt
        prompt = session.scalar(
            select(PersonaPrompt)
            .where(PersonaPrompt.persona_id == persona_uuid)
            .order_by(PersonaPrompt.created_at.desc())
        )
        
        if not prompt:
            # Create new prompt if it doesn't exist
            prompt = PersonaPrompt(
                persona_id=persona_uuid,
                system_prompt=payload.prompt or "",
                template_version="2025-01-18",
                created_at=datetime.utcnow()
            )
            session.add(prompt)
        else:
            # Update existing prompt
            if payload.prompt is not None:
                prompt.system_prompt = payload.prompt
        
        session.commit()
        session.refresh(prompt)
        
        return AiTemplateDefinition(
            template_id=f"persona-prompt-{persona.id}",
            label=payload.label or f"{persona.name} - System Prompt",
            description=payload.description or f"System prompt for persona: {persona.name}",
            category=payload.category or "Persona Prompts",
            tags=payload.tags or ["persona", "chat", "system-prompt"],
            default_provider=payload.default_provider or "anthropic",
            default_model=payload.default_model or "claude-3-5-haiku-20241022",
            temperature=payload.temperature or 0.4,
            max_tokens=payload.max_tokens or 600,
            prompt=prompt.system_prompt,
            output=payload.output or {"mode": "text"},
            metadata={
                "persona_id": str(persona.id),
                "persona_name": persona.name,
                "template_version": prompt.template_version,
            }
        )

