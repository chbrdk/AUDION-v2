from __future__ import annotations

from typing import List
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Persona
from ..schemas import AiAssistRequest, AiAssistResponse, AiPromptTestRequest, AiTemplateSummary
from ..services.ai_assist import AiAssistService, PromptTemplateRegistry
from ..services.auth import get_current_user
from ..services.access_control import list_accessible_project_ids
from ..services.usage_report import report_usage

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/ai-assist", tags=["ai"])
registry = PromptTemplateRegistry()


def get_db():
    with get_session() as session:
        yield session


from ..services.persona_ai_context import (
    build_persona_ai_context,
    build_persona_goals_ai_context,
    build_persona_interests_ai_context,
    build_persona_values_ai_context,
    build_persona_traits_ai_context,
    build_persona_vocabulary_ai_context,
    build_persona_sentence_structure_ai_context,
)

def _enrich_persona_context(
    session: Session,
    context: dict,
    allowed_project_ids: list[UUID] | None = None,
) -> dict:
    """Enrich context with persona data if persona_id is present."""
    persona_id = context.get("persona_id")
    if not persona_id:
        return context
    
    # Validate UUID format
    try:
        persona_uuid = UUID(str(persona_id))
    except (ValueError, TypeError):
        logger.warning("ai.assist.invalid_persona_id", persona_id=str(persona_id))
        return context

    persona = session.get(Persona, persona_uuid)
    if not persona:
        logger.warning("ai.assist.persona_not_found", persona_id=str(persona_id))
        return context
        
    if allowed_project_ids is not None and persona.project_id not in allowed_project_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Persona access denied")
    
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
    elif "traits" in template_id:
        persona_context = build_persona_traits_ai_context(session, persona, max_items)
    elif "vocabulary" in template_id:
        persona_context = build_persona_vocabulary_ai_context(session, persona, max_items)
    elif "sentence_structure" in template_id:
        persona_context = build_persona_sentence_structure_ai_context(session, persona)
    else:
        # Default: use pain_points context builder
        persona_context = build_persona_ai_context(session, persona, max_items)
    
    # Merge persona context with existing context (persona context takes precedence)
    enriched = {**context, **persona_context}
    return enriched


def allowed_project_ids_dep(
    current_user=Depends(get_current_user),
    session: Session = Depends(get_db),
) -> list[UUID]:
    return list_accessible_project_ids(session, current_user.id)


@router.get(
    "/templates",
    response_model=List[AiTemplateSummary],
    summary="List available AI prompt templates",
)
def list_templates(
    project_id: str | None = Query(None),
    allowed_project_ids: list[UUID] = Depends(allowed_project_ids_dep),
    session: Session = Depends(get_db),
) -> List[AiTemplateSummary]:
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


@router.post(
    "",
    response_model=AiAssistResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute an AI assist template",
)
async def execute_ai_assist(
    payload: AiAssistRequest,
    project_id: str | None = Query(None),
    current_user=Depends(get_current_user),
    allowed_project_ids: list[UUID] = Depends(allowed_project_ids_dep),
    session: Session = Depends(get_db),
) -> AiAssistResponse:
    try:
        if project_id:
            try:
                project_uuid = UUID(project_id)
            except ValueError as exc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project_id") from exc
            if project_uuid not in allowed_project_ids:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project access denied")
        # Enrich context with persona data if persona_id is present
        enriched_context = _enrich_persona_context(
            session,
            {**payload.context, "_template_id": payload.template_id},
            allowed_project_ids=allowed_project_ids,
        )
        
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
        
        service = AiAssistService(registry=registry, project_id=project_id)
        service.session = session
        response = await service.generate(enriched_request)
        user_id = (getattr(current_user, "plexon_user_id", None) or str(current_user.id)) if current_user else None
        if user_id and response.usage:
            report_usage(
                user_id=user_id,
                event_type="llm_request",
                raw_units={
                    "input_tokens": response.usage.get("input_tokens") or response.usage.get("prompt_tokens"),
                    "output_tokens": response.usage.get("output_tokens") or response.usage.get("completion_tokens"),
                },
            )
        return response
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
async def test_prompt(
    payload: AiPromptTestRequest,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_db),
) -> AiAssistResponse:
    """Test a custom prompt directly without requiring a template."""
    try:
        # Enrich context with persona data if persona_id is present
        # We don't check project_id param here as it's a raw test, but we pass allowed_project_ids
        # to ensure the user can only access personas they are allowed to see.
        allowed_project_ids = list_accessible_project_ids(session, current_user.id)
        
        # Helper to serialize context for logging (handling non-serializable objects)
        def log_context(ctx, name="context"):
            debug_ctx = {}
            for k, v in ctx.items():
                if isinstance(v, (str, int, float, bool, type(None))):
                    debug_ctx[k] = v
                else:
                    debug_ctx[k] = f"<{type(v).__name__}>"
            logger.info(f"ai.assist.test_prompt.{name}", keys=list(ctx.keys()), sample=debug_ctx)

        log_context(payload.context, "original_context")

        enriched_context = _enrich_persona_context(
            session,
            payload.context,
            allowed_project_ids=allowed_project_ids,
        )
        
        log_context(enriched_context, "enriched_context")

        service = AiAssistService(registry=registry)
        service.session = session
        response = await service.test_prompt(
            prompt=payload.prompt,
            context=enriched_context,
            provider=payload.provider,
            model=payload.model,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens,
        )
        user_id = (getattr(current_user, "plexon_user_id", None) or str(current_user.id)) if current_user else None
        if user_id and response.usage:
            report_usage(
                user_id=user_id,
                event_type="llm_request",
                raw_units={
                    "input_tokens": response.usage.get("input_tokens") or response.usage.get("prompt_tokens"),
                    "output_tokens": response.usage.get("output_tokens") or response.usage.get("completion_tokens"),
                },
            )
        return response
    except RuntimeError as exc:
        logger.warning("ai.assist.provider_not_ready", error=str(exc))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("ai.assist.test_failed", error=str(exc))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Prompt test failed") from exc
