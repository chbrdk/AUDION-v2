from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, status

from ..core.config import get_settings
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

