from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from .schemas import ErrorBody, PersonaSummary, SessionRequest
from .service import (
    LanguageNotAvailableError,
    PersonaNotFoundError,
    compose_session_stub,
    get_session,
    list_persona_summaries,
    validate_against_schema,
)

router = APIRouter(prefix="/v1", tags=["persona-reality"])


@router.post(
    "/sessions",
    status_code=status.HTTP_201_CREATED,
    summary="Compose a new Persona Reality session",
    responses={
        404: {"model": ErrorBody},
        500: {"model": ErrorBody},
    },
)
async def compose_session(request: SessionRequest) -> dict:
    try:
        config = compose_session_stub(request)
        validate_against_schema(config)
    except PersonaNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "persona_not_found", "message": str(exc), "details": {"persona_id": exc.persona_id}},
        ) from exc
    except LanguageNotAvailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "persona_not_found",
                "message": str(exc),
                "details": {"persona_id": exc.persona_id, "language": exc.language},
            },
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "schema_validation_failed", "message": str(exc), "details": {}},
        ) from exc
    return config


@router.get("/sessions/{session_id}", summary="Retrieve an existing session config")
async def get_session_config(session_id: str) -> dict:
    config = get_session(session_id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "session_not_found", "message": f"Session not found: {session_id}", "details": {}},
        )
    return config


@router.get("/personas", summary="List available VR personas (booth selector)")
async def list_personas() -> list[PersonaSummary]:
    return [PersonaSummary.model_validate(p) for p in list_persona_summaries()]
