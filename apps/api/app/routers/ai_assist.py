from __future__ import annotations

from typing import List

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_session
from ..schemas import AiAssistRequest, AiAssistResponse, AiPromptTestRequest, AiTemplateSummary
from ..services.ai_assist import AiAssistService, PromptTemplateRegistry

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/ai-assist", tags=["ai"])
registry = PromptTemplateRegistry()


def get_db():
    with get_session() as session:
        yield session


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
        service = AiAssistService(registry=registry)
        service.session = session
        return await service.generate(payload)
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


