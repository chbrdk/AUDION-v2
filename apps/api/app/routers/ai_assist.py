from __future__ import annotations

from typing import List
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Persona
from ..schemas import AiAssistRequest, AiAssistResponse, AiPromptTestRequest, AiTemplateSummary
from ..services.ai_assist import AiAssistService, PromptTemplateRegistry

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/ai-assist", tags=["ai"])
registry = PromptTemplateRegistry()


def get_db():
    with get_session() as session:
        yield session


def _enrich_persona_context(session: Session, context: dict) -> dict:
    """Enrich context with persona data if persona_id is present."""
    persona_id = context.get("persona_id")
    if not persona_id:
        return context
    
    try:
        persona_uuid = UUID(str(persona_id))
        persona = session.get(Persona, persona_uuid)
        if not persona:
            logger.warning("ai.assist.persona_not_found", persona_id=str(persona_id))
            return context
        
        # Import helper functions from persona_ai_context service
        from ..services.persona_ai_context import (
            build_persona_ai_context,
            build_persona_goals_ai_context,
            build_persona_interests_ai_context,
            build_persona_values_ai_context,
        )
        
        # Determine which context builder to use based on template_id
        template_id = context.get("_template_id", "")
        max_items = context.get("max_items") or context.get("max_suggestions") or 3
        
        if "pain_points" in template_id:
            persona_context = build_persona_ai_context(session, persona, max_items)
        elif "goals" in template_id:
            persona_context = build_persona_goals_ai_context(session, persona, max_items)
        elif "interests" in template_id:
            persona_context = build_persona_interests_ai_context(session, persona, max_items)
        elif "values" in template_id:
            persona_context = build_persona_values_ai_context(session, persona, max_items)
        else:
            # Default: use pain_points context builder
            persona_context = build_persona_ai_context(session, persona, max_items)
        
        # Merge persona context with existing context (persona context takes precedence)
        enriched = {**context, **persona_context}
        return enriched
    except (ValueError, TypeError) as exc:
        logger.warning("ai.assist.invalid_persona_id", persona_id=str(persona_id), error=str(exc))
        return context
    except Exception as exc:
        logger.warning("ai.assist.persona_context_failed", persona_id=str(persona_id), error=str(exc))
        return context


@router.get(
    "/templates",
    response_model=List[AiTemplateSummary],
    summary="List available AI prompt templates",
)
def list_templates() -> List[AiTemplateSummary]:
    return registry.list_templates()


@router.post(
    "",
    response_model=AiAssistResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute an AI assist template",
)
async def execute_ai_assist(payload: AiAssistRequest, session: Session = Depends(get_db)) -> AiAssistResponse:
    try:
        # Enrich context with persona data if persona_id is present
        enriched_context = _enrich_persona_context(session, {**payload.context, "_template_id": payload.template_id})
        
        # Create new request with enriched context
        enriched_request = AiAssistRequest(
            template_id=payload.template_id,
            provider=payload.provider,
            model=payload.model,
            context=enriched_context,
            prompt_variables=payload.prompt_variables,
            max_suggestions=payload.max_suggestions,
            metadata=payload.metadata,
        )
        
        service = AiAssistService(registry=registry)
        service.session = session
        return await service.generate(enriched_request)
    except KeyError as exc:
        logger.warning("ai.assist.template_missing", template_id=payload.template_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.warning("ai.assist.provider_not_ready", error=str(exc))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("ai.assist.failed", error=str(exc))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="AI assist failed") from exc


@router.post(
    "/test",
    response_model=AiAssistResponse,
    status_code=status.HTTP_200_OK,
    summary="Test a custom prompt directly without a template",
)
async def test_prompt(payload: AiPromptTestRequest, session: Session = Depends(get_db)) -> AiAssistResponse:
    """Test a custom prompt directly without requiring a template."""
    try:
        service = AiAssistService(registry=registry)
        service.session = session
        return await service.test_prompt(
            prompt=payload.prompt,
            context=payload.context,
            provider=payload.provider,
            model=payload.model,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens,
        )
    except RuntimeError as exc:
        logger.warning("ai.assist.provider_not_ready", error=str(exc))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("ai.assist.test_failed", error=str(exc))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Prompt test failed") from exc


