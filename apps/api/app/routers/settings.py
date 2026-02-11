from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from uuid import UUID

from ..core.config import get_settings
from ..db import get_db, get_session
from ..models import Persona, PersonaPrompt, User
from ..schemas import AiTemplateDefinition, AiTemplateSummary, AiTemplateUpdateRequest
from ..services.ai_assist import AiAssistService, PromptTemplateRegistry
from ..services.auth import get_current_user
from ..services.access_control import list_accessible_project_ids

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])
registry = PromptTemplateRegistry()


@router.get("/ai/providers")
def list_ai_providers(_current_user: User = Depends(get_current_user)) -> dict:
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


def _allowed_project_ids(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> list[UUID]:
    return list_accessible_project_ids(session, current_user.id)


@router.get("/ai/templates", response_model=list[AiTemplateSummary])
def list_ai_templates(
    project_id: str | None = Query(None),
    allowed_project_ids: list[UUID] = Depends(_allowed_project_ids),
    session: Session = Depends(get_db),
) -> list[AiTemplateSummary]:
    if not project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="project_id is required")
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project_id") from exc
    if project_uuid not in allowed_project_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project access denied")
    service = AiAssistService(registry=registry)
    return service.list_templates_for_project(session=session, project_id=project_id)


@router.get("/ai/templates/{template_id}", response_model=AiTemplateDefinition)
def get_ai_template(
    template_id: str,
    project_id: str | None = Query(None),
    allowed_project_ids: list[UUID] = Depends(_allowed_project_ids),
    session: Session = Depends(get_db),
) -> AiTemplateDefinition:
    """Get full template definition including prompt and output config."""
    if not project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="project_id is required")
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project_id") from exc
    if project_uuid not in allowed_project_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project access denied")
    try:
        service = AiAssistService(registry=registry)
        return service.get_template_for_project(session=session, project_id=project_id, template_id=template_id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/ai/templates/{template_id}", response_model=AiTemplateDefinition)
def update_ai_template(
    template_id: str,
    payload: AiTemplateUpdateRequest,
    project_id: str | None = Query(None),
    allowed_project_ids: list[UUID] = Depends(_allowed_project_ids),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> AiTemplateDefinition:
    """Update a template's metadata, prompt, or configuration."""
    try:
        if not project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="project_id is required")
        try:
            project_uuid = UUID(project_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project_id") from exc
        if project_uuid not in allowed_project_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project access denied")

        # Convert Pydantic model to dict, excluding None values
        updates = payload.model_dump(exclude_unset=True, exclude_none=False)
        # Remove None values manually to allow partial updates
        updates = {k: v for k, v in updates.items() if v is not None}
        
        if not updates:
            # No updates provided, return current template
            service = AiAssistService(registry=registry)
            return service.get_template_for_project(session=session, project_id=project_id, template_id=template_id)

        service = AiAssistService(registry=registry)
        return service.update_template_override(
            session=session,
            project_id=project_id,
            template_id=template_id,
            updates=updates,
            updated_by=current_user.email,
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("settings.template.update_failed", template_id=template_id, error=str(exc), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update template: {str(exc)}",
        ) from exc


@router.get("/ai/persona-prompts")
def list_persona_prompts(
    allowed_project_ids: list[UUID] = Depends(_allowed_project_ids),
) -> list[dict]:
    """List all persona prompts as template-like entries."""
    with get_session() as session:
        # Get all personas with their prompts
        personas = session.scalars(select(Persona).where(Persona.project_id.in_(allowed_project_ids))).all()
        prompts = []
        
        for persona in personas:
            prompt = session.scalar(
                select(PersonaPrompt)
                .where(PersonaPrompt.persona_id == persona.id)
                .order_by(PersonaPrompt.created_at.desc())
            )
            
            if prompt:
                # Read metadata from database
                metadata = prompt.template_metadata or {}
                
                prompts.append({
                    "template_id": f"persona-prompt-{persona.id}",
                    "label": metadata.get("label") or f"{persona.name} - System Prompt",
                    "description": metadata.get("description") or f"System prompt for persona: {persona.name}",
                    "category": metadata.get("category") or "Persona Prompts",
                    "tags": metadata.get("tags") or ["persona", "chat", "system-prompt"],
                    "default_provider": metadata.get("default_provider") or "anthropic",
                    "default_model": metadata.get("default_model") or "claude-3-5-haiku-20241022",
                    "persona_id": str(persona.id),
                    "persona_name": persona.name,
                })
        
        return prompts


@router.get("/ai/persona-prompts/{persona_id}", response_model=AiTemplateDefinition)
def get_persona_prompt(
    persona_id: str,
    allowed_project_ids: list[UUID] = Depends(_allowed_project_ids),
) -> AiTemplateDefinition:
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
        if not persona or persona.project_id not in allowed_project_ids:
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
        
        # Read metadata from database - ensure fresh data
        session.refresh(prompt)
        metadata = prompt.template_metadata or {}
        
        logger.info(
            "persona_prompt.get_metadata",
            persona_id=str(persona_uuid),
            metadata_keys=list(metadata.keys()) if metadata else [],
            metadata=metadata,
        )
        
        # Helper function to get value from metadata or use default
        # Handles None, 0, False, empty strings correctly
        def get_value(key: str, default: Any) -> Any:
            if key in metadata and metadata[key] is not None:
                return metadata[key]
            return default
        
        return AiTemplateDefinition(
            template_id=f"persona-prompt-{persona.id}",
            label=get_value("label", f"{persona.name} - System Prompt"),
            description=get_value("description", f"System prompt for persona: {persona.name}"),
            category=get_value("category", "Persona Prompts"),
            tags=get_value("tags", ["persona", "chat", "system-prompt"]),
            default_provider=get_value("default_provider", "anthropic"),
            default_model=get_value("default_model", "claude-3-5-haiku-20241022"),
            temperature=get_value("temperature", 0.4),
            max_tokens=get_value("max_tokens", 1024),
            prompt=prompt.system_prompt,
            output=get_value("output", {"mode": "text"}),
            metadata={
                "persona_id": str(persona.id),
                "persona_name": persona.name,
                "template_version": prompt.template_version,
            }
        )


@router.put("/ai/persona-prompts/{persona_id}", response_model=AiTemplateDefinition)
def update_persona_prompt(
    persona_id: str,
    payload: AiTemplateUpdateRequest,
    allowed_project_ids: list[UUID] = Depends(_allowed_project_ids),
) -> AiTemplateDefinition:
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
        if not persona or persona.project_id not in allowed_project_ids:
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
            template_metadata = {}
            if payload.label is not None:
                template_metadata["label"] = payload.label
            if payload.description is not None:
                template_metadata["description"] = payload.description
            if payload.category is not None:
                template_metadata["category"] = payload.category
            if payload.tags is not None:
                template_metadata["tags"] = payload.tags
            if payload.default_provider is not None:
                # Convert Enum to string for JSON serialization
                template_metadata["default_provider"] = payload.default_provider.value if hasattr(payload.default_provider, "value") else str(payload.default_provider)
            if payload.default_model is not None:
                template_metadata["default_model"] = payload.default_model
            if payload.temperature is not None:
                template_metadata["temperature"] = payload.temperature
            if payload.max_tokens is not None:
                template_metadata["max_tokens"] = payload.max_tokens
            if payload.output is not None:
                # Convert Pydantic model to dict for JSON serialization
                if hasattr(payload.output, "model_dump"):
                    template_metadata["output"] = payload.output.model_dump()
                elif hasattr(payload.output, "dict"):
                    template_metadata["output"] = payload.output.dict()
                else:
                    template_metadata["output"] = dict(payload.output)
            
            prompt = PersonaPrompt(
                persona_id=persona_uuid,
                system_prompt=payload.prompt or "",
                template_version="2025-01-18",
                created_at=datetime.utcnow(),
                template_metadata=template_metadata if template_metadata else None
            )
            session.add(prompt)
            logger.info(
                "persona_prompt.create_new",
                persona_id=str(persona_uuid),
                metadata_keys=list(template_metadata.keys()),
                template_metadata=template_metadata,
            )
        else:
            # Update existing prompt
            if payload.prompt is not None:
                prompt.system_prompt = payload.prompt
            
            # Update metadata - CRITICAL: Create new dict and flag as modified for SQLAlchemy
            existing_metadata = deepcopy(prompt.template_metadata) if prompt.template_metadata else {}
            
            if payload.label is not None:
                existing_metadata["label"] = payload.label
            if payload.description is not None:
                existing_metadata["description"] = payload.description
            if payload.category is not None:
                existing_metadata["category"] = payload.category
            if payload.tags is not None:
                existing_metadata["tags"] = payload.tags
            if payload.default_provider is not None:
                # Convert Enum to string for JSON serialization
                existing_metadata["default_provider"] = payload.default_provider.value if hasattr(payload.default_provider, "value") else str(payload.default_provider)
            if payload.default_model is not None:
                existing_metadata["default_model"] = payload.default_model
            if payload.temperature is not None:
                existing_metadata["temperature"] = payload.temperature
            if payload.max_tokens is not None:
                existing_metadata["max_tokens"] = payload.max_tokens
            if payload.output is not None:
                # Convert Pydantic model to dict for JSON serialization
                if hasattr(payload.output, "model_dump"):
                    existing_metadata["output"] = payload.output.model_dump()
                elif hasattr(payload.output, "dict"):
                    existing_metadata["output"] = payload.output.dict()
                else:
                    existing_metadata["output"] = dict(payload.output)
            
            # Always assign metadata dict (even if empty) and flag as modified
            prompt.template_metadata = existing_metadata
            flag_modified(prompt, "template_metadata")
            
            # Debug logging
            logger.info(
                "persona_prompt.update_metadata",
                persona_id=str(persona_uuid),
                metadata_keys=list(existing_metadata.keys()),
                max_tokens=existing_metadata.get("max_tokens"),
                metadata_dict=existing_metadata,
            )
        
        # Flush and commit changes
        session.flush()  # Flush before commit to ensure all changes are staged
        session.commit()
        session.refresh(prompt)
        
        # Verify the data was saved by reloading from database
        session.expire(prompt)
        session.refresh(prompt)
        logger.info(
            "persona_prompt.after_commit",
            persona_id=str(persona_uuid),
            saved_metadata=prompt.template_metadata,
            metadata_type=type(prompt.template_metadata).__name__,
        )
        
        # Read metadata from database
        metadata = prompt.template_metadata or {}
        
        # Helper function to get value with proper priority: metadata > payload > default
        # Handles None, 0, False, empty strings correctly
        def get_value(key: str, default: Any) -> Any:
            if key in metadata and metadata[key] is not None:
                return metadata[key]
            payload_val = getattr(payload, key, None)
            if payload_val is not None:
                return payload_val
            return default
        
        return AiTemplateDefinition(
            template_id=f"persona-prompt-{persona.id}",
            label=get_value("label", f"{persona.name} - System Prompt"),
            description=get_value("description", f"System prompt for persona: {persona.name}"),
            category=get_value("category", "Persona Prompts"),
            tags=get_value("tags", ["persona", "chat", "system-prompt"]),
            default_provider=get_value("default_provider", "anthropic"),
            default_model=get_value("default_model", "claude-3-5-haiku-20241022"),
            temperature=get_value("temperature", 0.4),
            max_tokens=get_value("max_tokens", 1024),
            prompt=prompt.system_prompt,
            output=get_value("output", {"mode": "text"}),
            metadata={
                "persona_id": str(persona.id),
                "persona_name": persona.name,
                "template_version": prompt.template_version,
            }
        )
