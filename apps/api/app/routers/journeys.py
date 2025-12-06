from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Tuple
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Journey, JourneyPhase, JourneyPhaseElement, JourneyExpectation
from ..schemas import AiAssistRequest
from ..schemas.journey import (
    ChangeResponse,
    ElementCreate,
    ElementResponse,
    ExpectationCreate,
    ExpectationResponse,
    InsightResponse,
    JourneyAiGenerateRequest,
    JourneyAiGenerationResponse,
    JourneyAiSuggestion,
    JourneyCreate,
    JourneyGenerateRequest,
    JourneyResponse,
    JourneyValidationReport,
    MeasurementResponse,
    PhaseCreate,
    PhaseResponse,
    ValidationRequest,
)
from ..services.ai_assist import AiAssistService
from ..services.persona_store import PersonaService
from ..services.target_group_store import TargetGroupService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/journeys", tags=["journeys"])
target_group_service = TargetGroupService()
persona_service = PersonaService()


def get_db():
    with get_session() as session:
        yield session


def _get_journey_or_404(session: Session, journey_id: str) -> Journey:
    try:
        journey_uuid = UUID(journey_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid journey id") from exc
    journey = session.get(Journey, journey_uuid)
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found") from exc
    return journey


def _get_phase_or_404(session: Session, phase_id: str) -> JourneyPhase:
    try:
        phase_uuid = UUID(phase_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid phase id") from exc
    phase = session.get(JourneyPhase, phase_uuid)
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found") from exc
    return phase


def _build_phase_snapshot(phase: JourneyPhase | None, overrides: Dict[str, Any] | None = None) -> Dict[str, Any]:
    snapshot = {
        "name": phase.name if phase else "New Phase",
        "description": phase.description if phase else "",
        "expected_emotion": phase.expected_emotion if phase else "",
    }
    if overrides:
        snapshot.update({k: v for k, v in overrides.items() if v is not None})
    return snapshot


def _summarize_target_group(session: Session, journey: Journey) -> Tuple[str, str]:
    if not journey.target_group_id:
        return ("Keine Target Group verknüpft.", "")
    try:
        target_group = target_group_service.get_target_group(session, str(journey.target_group_id))
    except ValueError:
        return ("Target Group konnte nicht geladen werden.", "")

    summary = f"{target_group.name} • Segment: {target_group.segment or 'n/a'}"
    if target_group.description:
        summary += f"\nBeschreibung: {target_group.description}"

    persona_lines: List[str] = []
    for persona_meta in target_group.personas[:3]:
        persona_lines.append(
            f"- {persona_meta.name}: Segment {persona_meta.segment or 'n/a'}, Status {persona_meta.status}"
        )
    persona_summaries = "\n".join(persona_lines) if persona_lines else "Keine Personas dokumentiert."
    return summary, persona_summaries


def _build_journey_ai_context(
    session: Session,
    journey: Journey,
    phase: JourneyPhase | None,
    phase_context: Dict[str, Any] | None,
    max_items: int,
) -> Dict[str, Any]:
    snapshot = _build_phase_snapshot(phase, phase_context)
    target_group_summary, persona_summaries = _summarize_target_group(session, journey)
    return {
        "journey_name": journey.name,
        "journey_type": journey.journey_type,
        "phase_name": snapshot.get("name", ""),
        "phase_description": snapshot.get("description", ""),
        "phase_expected_emotion": snapshot.get("expected_emotion", ""),
        "target_group_summary": target_group_summary,
        "persona_summaries": persona_summaries,
        "max_items": max_items,
    }


# CRUD Operations
@router.post(
    "/generate",
    response_model=JourneyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new journey using AI",
)
async def generate_journey(
    payload: JourneyGenerateRequest,
    session: Session = Depends(get_db),
) -> JourneyResponse:
    """
    Generate a journey using AI based on target group, personas, and knowledge.
    
    Can run synchronously (default) or asynchronously via Celery task.
    """
    from ..services.journey_generation import JourneyGenerationService
    from ..tasks.journey_tasks import generate_journey_task
    
    try:
        # Validate UUIDs
        try:
            target_group_uuid = UUID(payload.target_group_id)
            organization_uuid = UUID(payload.organization_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid UUID format: {exc}") from exc
        
        project_uuid = None
        if payload.project_id:
            try:
                project_uuid = UUID(payload.project_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid project_id format: {payload.project_id}") from exc
        
        # If async mode, start Celery task
        if payload.use_async:
            task = generate_journey_task.delay(
                target_group_id=payload.target_group_id,
                journey_type=payload.journey_type,
                organization_id=payload.organization_id,
                user_id=payload.created_by or "system",
                project_id=payload.project_id,
            )
            # Return a placeholder journey with task_id in metadata
            # In production, you might want a separate endpoint to check task status
            raise HTTPException(
                status_code=202,
                detail=f"Journey generation started. Task ID: {task.id}. Use /journeys/tasks/{task.id} to check status."
            )
        
        # Synchronous generation
        service = JourneyGenerationService()
        
        # Generate journey draft
        journey_draft = await service.generate_journey_from_knowledge(
            target_group_id=target_group_uuid,
            journey_type=payload.journey_type,
            organization_id=organization_uuid,
        )
        
        # Save journey
        journey = service.save_journey_draft(
            draft=journey_draft,
            target_group_id=target_group_uuid,
            organization_id=organization_uuid,
            project_id=project_uuid,
            created_by=payload.created_by,
        )
        
        # Reload journey from current session to get relationships
        journey_id = journey.id
        journey = session.get(Journey, journey_id)
        if not journey:
            raise HTTPException(status_code=404, detail="Journey not found after creation")
        
        return _journey_to_response(journey)
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("journey.generate.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate journey: {str(exc)}") from exc


@router.post(
    "",
    response_model=JourneyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new journey",
)
def create_journey(
    payload: JourneyCreate,
    session: Session = Depends(get_db),
) -> JourneyResponse:
    try:
        # Validate UUIDs
        if not payload.organization_id:
            raise HTTPException(status_code=400, detail="organization_id is required")
        try:
            organization_uuid = UUID(payload.organization_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid organization_id format: {payload.organization_id}") from exc
        
        project_uuid = None
        if payload.project_id:
            try:
                project_uuid = UUID(payload.project_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid project_id format: {payload.project_id}") from exc
        
        target_group_uuid = None
        if payload.target_group_id:
            try:
                target_group_uuid = UUID(payload.target_group_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid target_group_id format: {payload.target_group_id}") from exc
        
        journey = Journey(
            organization_id=organization_uuid,
            project_id=project_uuid,
            target_group_id=target_group_uuid,
            name=payload.name,
            description=payload.description,
            journey_type=payload.journey_type,
            creation_mode=payload.creation_mode,
            created_by=payload.created_by,
        )
        session.add(journey)
        session.commit()
        session.refresh(journey)
        return _journey_to_response(journey)
    except HTTPException:
        raise
    except Exception as exc:
        session.rollback()
        logger.error("journey.create.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/{journey_id}",
    response_model=JourneyResponse,
    summary="Get journey details",
)
def get_journey(
    journey_id: str,
    session: Session = Depends(get_db),
) -> JourneyResponse:
    journey = _get_journey_or_404(session, journey_id)
    return _journey_to_response(journey)


@router.put(
    "/{journey_id}",
    response_model=JourneyResponse,
    summary="Update journey",
)
def update_journey(
    journey_id: str,
    payload: JourneyCreate,
    session: Session = Depends(get_db),
) -> JourneyResponse:
    journey = _get_journey_or_404(session, journey_id)
    try:
        journey.name = payload.name
        journey.description = payload.description
        journey.journey_type = payload.journey_type
        journey.creation_mode = payload.creation_mode
        if payload.target_group_id:
            journey.target_group_id = UUID(payload.target_group_id)
        session.commit()
        session.refresh(journey)
        return _journey_to_response(journey)
    except Exception as exc:
        session.rollback()
        logger.error("journey.update.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete(
    "/{journey_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete journey",
)
def delete_journey(
    journey_id: str,
    session: Session = Depends(get_db),
):
    journey = _get_journey_or_404(session, journey_id)
    try:
        session.delete(journey)
        session.commit()
    except Exception as exc:
        session.rollback()
        logger.error("journey.delete.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "",
    response_model=List[JourneyResponse],
    summary="List journeys",
)
def list_journeys(
    target_group_id: str | None = Query(None),
    project_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_db),
) -> List[JourneyResponse]:
    stmt = select(Journey)
    if target_group_id:
        stmt = stmt.where(Journey.target_group_id == UUID(target_group_id))
    if project_id:
        stmt = stmt.where(Journey.project_id == UUID(project_id))
    
    journeys = session.scalars(
        stmt.offset((page - 1) * page_size).limit(page_size)
    ).all()
    return [_journey_to_response(j) for j in journeys]


@router.post(
    "/{journey_id}/ai/generate",
    response_model=JourneyAiGenerationResponse,
    summary="Generate AI-assisted suggestions for a journey",
)
async def generate_journey_ai_content(
    journey_id: str,
    payload: JourneyAiGenerateRequest,
    session: Session = Depends(get_db),
) -> JourneyAiGenerationResponse:
    journey = _get_journey_or_404(session, journey_id)
    phase = None
    if payload.phase_id:
        phase = _get_phase_or_404(session, payload.phase_id)
    try:
        # Build base context from journey data
        base_context = _build_journey_ai_context(
            session=session,
            journey=journey,
            phase=phase,
            phase_context=payload.phase_context or {},
            max_items=payload.max_suggestions,
        )
        # Merge with phase_context to include frontend-provided variables
        # (e.g., existing_phases_summary, last_phase_summary, etc.)
        context = {**base_context, **(payload.phase_context or {})}
        ai_request = AiAssistRequest(
            template_id=payload.template_id,
            context=context,
            prompt_variables=payload.prompt_variables or {},
            max_suggestions=payload.max_suggestions,
        )
        ai_assist_service = AiAssistService(session=session)
        ai_response = await ai_assist_service.generate(ai_request)
        suggestions = [
            JourneyAiSuggestion(
                element_type=item.type,
                title=item.title,
                content=item.content,
            )
            for item in ai_response.suggestions
        ]
        return JourneyAiGenerationResponse(
            template_id=payload.template_id,
            suggestions=suggestions,
            raw_output=ai_response.raw_output,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("journey.ai.generate.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate AI suggestions") from exc


# Phase Operations
@router.post(
    "/{journey_id}/phases",
    response_model=PhaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create phase",
)
def create_phase(
    journey_id: str,
    payload: PhaseCreate,
    session: Session = Depends(get_db),
) -> PhaseResponse:
    journey = _get_journey_or_404(session, journey_id)
    try:
        phase = JourneyPhase(
            journey_id=journey.id,
            name=payload.name,
            description=payload.description,
            phase_order=payload.phase_order,
            expected_duration_min=payload.expected_duration_min,
            expected_duration_max=payload.expected_duration_max,
            duration_unit=payload.duration_unit,
            expected_emotion=payload.expected_emotion,
            emotion_intensity=payload.emotion_intensity,
            url_pattern=payload.url_pattern,
            form_id=payload.form_id,
            event_names=payload.event_names,
        )
        session.add(phase)
        session.commit()
        session.refresh(phase)
        return _phase_to_response(phase)
    except Exception as exc:
        session.rollback()
        logger.error("phase.create.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put(
    "/{journey_id}/phases/{phase_id}",
    response_model=PhaseResponse,
    summary="Update phase",
)
def update_phase(
    journey_id: str,
    phase_id: str,
    payload: PhaseCreate,
    session: Session = Depends(get_db),
) -> PhaseResponse:
    _get_journey_or_404(session, journey_id)
    phase = _get_phase_or_404(session, phase_id)
    try:
        phase.name = payload.name
        phase.description = payload.description
        phase.phase_order = payload.phase_order
        phase.expected_duration_min = payload.expected_duration_min
        phase.expected_duration_max = payload.expected_duration_max
        phase.duration_unit = payload.duration_unit
        phase.expected_emotion = payload.expected_emotion
        phase.emotion_intensity = payload.emotion_intensity
        phase.url_pattern = payload.url_pattern
        phase.form_id = payload.form_id
        phase.event_names = payload.event_names
        session.commit()
        session.refresh(phase)
        return _phase_to_response(phase)
    except Exception as exc:
        session.rollback()
        logger.error("phase.update.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete(
    "/{journey_id}/phases/{phase_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete phase",
)
def delete_phase(
    journey_id: str,
    phase_id: str,
    session: Session = Depends(get_db),
):
    _get_journey_or_404(session, journey_id)
    phase = _get_phase_or_404(session, phase_id)
    try:
        session.delete(phase)
        session.commit()
    except Exception as exc:
        session.rollback()
        logger.error("phase.delete.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/{journey_id}/phases/{phase_id}/reorder",
    summary="Reorder phases",
)
def reorder_phases(
    journey_id: str,
    phase_id: str,
    new_order: int = Query(..., ge=0),
    session: Session = Depends(get_db),
):
    _get_journey_or_404(session, journey_id)
    phase = _get_phase_or_404(session, phase_id)
    try:
        phase.phase_order = new_order
        session.commit()
        return {"status": "ok"}
    except Exception as exc:
        session.rollback()
        logger.error("phase.reorder.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# Element Operations
@router.post(
    "/{journey_id}/phases/{phase_id}/elements",
    response_model=ElementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create element",
)
def create_element(
    journey_id: str,
    phase_id: str,
    payload: ElementCreate,
    session: Session = Depends(get_db),
) -> ElementResponse:
    _get_journey_or_404(session, journey_id)
    phase = _get_phase_or_404(session, phase_id)
    try:
        element = JourneyPhaseElement(
            phase_id=phase.id,
            element_type=payload.element_type,
            content=payload.content,
            element_order=payload.element_order,
            element_metadata=payload.metadata,  # Use element_metadata attribute
            source_type=payload.source_type,
            source_chunk_ids=payload.source_chunk_ids,
            confidence=payload.confidence,
        )
        session.add(element)
        session.commit()
        session.refresh(element)
        return _element_to_response(element)
    except Exception as exc:
        session.rollback()
        logger.error("element.create.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put(
    "/{journey_id}/phases/{phase_id}/elements/{element_id}",
    response_model=ElementResponse,
    summary="Update element",
)
def update_element(
    journey_id: str,
    phase_id: str,
    element_id: str,
    payload: ElementCreate,
    session: Session = Depends(get_db),
) -> ElementResponse:
    _get_journey_or_404(session, journey_id)
    _get_phase_or_404(session, phase_id)
    try:
        element_uuid = UUID(element_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid element id") from exc
    element = session.get(JourneyPhaseElement, element_uuid)
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")
    try:
        element.element_type = payload.element_type
        element.content = payload.content
        element.element_order = payload.element_order
        element.element_metadata = payload.metadata  # Use element_metadata attribute
        element.source_type = payload.source_type
        element.source_chunk_ids = payload.source_chunk_ids
        element.confidence = payload.confidence
        session.commit()
        session.refresh(element)
        return _element_to_response(element)
    except Exception as exc:
        session.rollback()
        logger.error("element.update.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete(
    "/{journey_id}/phases/{phase_id}/elements/{element_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete element",
)
def delete_element(
    journey_id: str,
    phase_id: str,
    element_id: str,
    session: Session = Depends(get_db),
):
    _get_journey_or_404(session, journey_id)
    _get_phase_or_404(session, phase_id)
    try:
        element_uuid = UUID(element_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid element id") from exc
    element = session.get(JourneyPhaseElement, element_uuid)
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")
    try:
        session.delete(element)
        session.commit()
    except Exception as exc:
        session.rollback()
        logger.error("element.delete.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# Expectation Operations
@router.post(
    "/{journey_id}/phases/{phase_id}/expectations",
    response_model=ExpectationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create expectation",
)
def create_expectation(
    journey_id: str,
    phase_id: str,
    payload: ExpectationCreate,
    session: Session = Depends(get_db),
) -> ExpectationResponse:
    _get_journey_or_404(session, journey_id)
    phase = _get_phase_or_404(session, phase_id)
    try:
        expectation = JourneyExpectation(
            phase_id=phase.id,
            metric_type=payload.metric_type,
            metric_name=payload.metric_name,
            expected_value=payload.expected_value,
            expected_value_max=payload.expected_value_max,
            unit=payload.unit,
            comparison=payload.comparison,
            warning_threshold_percent=payload.warning_threshold_percent,
            critical_threshold_percent=payload.critical_threshold_percent,
            hypothesis=payload.hypothesis,
            based_on_persona_id=UUID(payload.based_on_persona_id) if payload.based_on_persona_id else None,
            data_source=payload.data_source,
            data_source_config=payload.data_source_config,
        )
        session.add(expectation)
        session.commit()
        session.refresh(expectation)
        return _expectation_to_response(expectation)
    except Exception as exc:
        session.rollback()
        logger.error("expectation.create.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/{journey_id}/phases/{phase_id}/expectations",
    response_model=List[ExpectationResponse],
    summary="List expectations",
)
def list_expectations(
    journey_id: str,
    phase_id: str,
    session: Session = Depends(get_db),
) -> List[ExpectationResponse]:
    _get_journey_or_404(session, journey_id)
    phase = _get_phase_or_404(session, phase_id)
    expectations = session.scalars(
        select(JourneyExpectation).where(JourneyExpectation.phase_id == phase.id)
    ).all()
    return [_expectation_to_response(e) for e in expectations]


# Validation
@router.post(
    "/{journey_id}/validate",
    response_model=JourneyValidationReport,
    summary="Validate journey against personas",
)
async def validate_journey(
    journey_id: str,
    payload: ValidationRequest,
    session: Session = Depends(get_db),
) -> JourneyValidationReport:
    from ..services.journey_validation import JourneyValidationService
    
    service = JourneyValidationService()
    
    # Validate against first persona (can be extended to validate against all)
    if not payload.persona_ids:
        raise HTTPException(status_code=400, detail="At least one persona_id required")
    
    persona_id = UUID(payload.persona_ids[0])
    journey_uuid = UUID(journey_id)
    
    try:
        report = await service.validate_journey_against_persona(
            journey_id=journey_uuid,
            persona_id=persona_id,
            mode=payload.mode,
        )
        return report
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("journey.validate.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get(
    "/{journey_id}/validation-report",
    response_model=JourneyValidationReport,
    summary="Get validation report",
)
async def get_validation_report(
    journey_id: str,
    persona_id: str | None = Query(None),
    session: Session = Depends(get_db),
) -> JourneyValidationReport:
    from ..services.journey_validation import JourneyValidationService
    
    if not persona_id:
        raise HTTPException(status_code=400, detail="persona_id query parameter required")
    
    service = JourneyValidationService()
    journey_uuid = UUID(journey_id)
    persona_uuid = UUID(persona_id)
    
    try:
        report = await service.validate_journey_against_persona(
            journey_id=journey_uuid,
            persona_id=persona_uuid,
        )
        return report
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("journey.validation_report.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Reality Tracking
@router.post(
    "/{journey_id}/tracking/configure",
    summary="Configure tracking",
)
def configure_tracking(
    journey_id: str,
    session: Session = Depends(get_db),
):
    journey = _get_journey_or_404(session, journey_id)
    try:
        journey.tracking_enabled = True
        session.commit()
        return {"status": "ok", "tracking_enabled": True}
    except Exception as exc:
        session.rollback()
        logger.error("tracking.configure.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/{journey_id}/tracking/sync",
    summary="Sync measurements",
)
async def sync_measurements(
    journey_id: str,
    period_start: str | None = Query(None),
    period_end: str | None = Query(None),
    session: Session = Depends(get_db),
):
    from ..services.analytics_integration import AnalyticsIntegrationService
    
    service = AnalyticsIntegrationService()
    journey_uuid = UUID(journey_id)
    
    # Default to last 7 days if not specified
    if not period_start:
        period_start = (datetime.now().date() - timedelta(days=7)).isoformat()
    if not period_end:
        period_end = datetime.now().date().isoformat()
    
    period_start_date = date.fromisoformat(period_start)
    period_end_date = date.fromisoformat(period_end)
    
    try:
        measurements = await service.sync_measurements(
            journey_id=journey_uuid,
            period_start=period_start_date,
            period_end=period_end_date,
        )
        return {"status": "ok", "measurements_count": len(measurements)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("journey.sync_measurements.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get(
    "/{journey_id}/measurements",
    response_model=List[MeasurementResponse],
    summary="Get measurements",
)
def get_measurements(
    journey_id: str,
    session: Session = Depends(get_db),
) -> List[MeasurementResponse]:
    from ..models import JourneyMeasurement
    from ..schemas.journey import MeasurementResponse
    
    journey = _get_journey_or_404(session, journey_id)
    
    # Get all measurements for all expectations in this journey
    measurements = []
    for phase in journey.phases:
        for expectation in phase.expectations:
            phase_measurements = session.scalars(
                select(JourneyMeasurement)
                .where(JourneyMeasurement.expectation_id == expectation.id)
                .order_by(JourneyMeasurement.synced_at.desc())
            ).all()
            for m in phase_measurements:
                measurements.append(
                    MeasurementResponse(
                        id=str(m.id),
                        expectation_id=str(m.expectation_id),
                        actual_value=m.actual_value,
                        delta_absolute=m.delta_absolute,
                        delta_percent=m.delta_percent,
                        status=m.status.value,
                        period_start=m.period_start,
                        period_end=m.period_end,
                        synced_at=m.synced_at,
                        sample_size=m.sample_size,
                        data_source=m.data_source,
                        raw_data=m.raw_data,
                    )
                )
    
    return measurements


# Insights & Learning
@router.get(
    "/{journey_id}/insights",
    response_model=List[InsightResponse],
    summary="Get insights",
)
def get_insights(
    journey_id: str,
    session: Session = Depends(get_db),
) -> List[InsightResponse]:
    from ..models import JourneyInsight
    
    journey = _get_journey_or_404(session, journey_id)
    
    insights = session.scalars(
        select(JourneyInsight)
        .where(JourneyInsight.journey_id == journey.id)
        .order_by(JourneyInsight.created_at.desc())
    ).all()
    
    return [
        InsightResponse(
            id=str(i.id),
            journey_id=str(i.journey_id),
            phase_id=str(i.phase_id) if i.phase_id else None,
            expectation_id=str(i.expectation_id) if i.expectation_id else None,
            insight_type=i.insight_type.value,
            title=i.title,
            description=i.description,
            ai_analysis=i.ai_analysis,
            ai_recommendations=i.ai_recommendations,
            evidence=i.evidence,
            confidence=i.confidence,
            priority=i.priority,
            status=i.status.value,
            created_at=i.created_at,
            updated_at=i.updated_at,
        )
        for i in insights
    ]


@router.post(
    "/{journey_id}/insights/{insight_id}/action",
    summary="Action insight",
)
def action_insight(
    journey_id: str,
    insight_id: str,
    status: str = Query("actioned", description="New status: acknowledged, actioned, dismissed"),
    session: Session = Depends(get_db),
):
    from ..models import JourneyInsight, JourneyInsightStatus
    
    _get_journey_or_404(session, journey_id)
    
    try:
        insight_uuid = UUID(insight_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid insight id") from exc
    
    insight = session.get(JourneyInsight, insight_uuid)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    
    try:
        insight.status = JourneyInsightStatus(status)
        session.commit()
        return {"status": "ok", "insight_id": insight_id, "new_status": status}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status}") from exc
    except Exception as exc:
        session.rollback()
        logger.error("insight.action.failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Change Tracking
@router.post(
    "/{journey_id}/changes",
    response_model=ChangeResponse,
    summary="Create change",
)
def create_change(
    journey_id: str,
    title: str = Query(...),
    description: str | None = Query(None),
    change_type: str = Query(...),
    phase_id: str | None = Query(None),
    triggered_by_insight_id: str | None = Query(None),
    session: Session = Depends(get_db),
) -> ChangeResponse:
    from ..models import JourneyChange
    
    journey = _get_journey_or_404(session, journey_id)
    
    change = JourneyChange(
        journey_id=journey.id,
        phase_id=UUID(phase_id) if phase_id else None,
        title=title,
        description=description,
        change_type=change_type,
        triggered_by_insight_id=UUID(triggered_by_insight_id) if triggered_by_insight_id else None,
    )
    session.add(change)
    session.commit()
    session.refresh(change)
    
    return ChangeResponse(
        id=str(change.id),
        journey_id=str(change.journey_id),
        phase_id=str(change.phase_id) if change.phase_id else None,
        title=change.title,
        description=change.description,
        change_type=change.change_type,
        triggered_by_insight_id=str(change.triggered_by_insight_id) if change.triggered_by_insight_id else None,
        expected_metric=change.expected_metric,
        expected_improvement_percent=change.expected_improvement_percent,
        implementation_status=change.implementation_status,
        implemented_at=change.implemented_at,
        actual_improvement_percent=change.actual_improvement_percent,
        result_status=change.result_status,
        created_at=change.created_at,
        updated_at=change.updated_at,
    )


@router.get(
    "/{journey_id}/changes",
    response_model=List[ChangeResponse],
    summary="List changes",
)
def list_changes(
    journey_id: str,
    session: Session = Depends(get_db),
) -> List[ChangeResponse]:
    from ..models import JourneyChange
    
    journey = _get_journey_or_404(session, journey_id)
    
    changes = session.scalars(
        select(JourneyChange)
        .where(JourneyChange.journey_id == journey.id)
        .order_by(JourneyChange.created_at.desc())
    ).all()
    
    return [
        ChangeResponse(
            id=str(c.id),
            journey_id=str(c.journey_id),
            phase_id=str(c.phase_id) if c.phase_id else None,
            title=c.title,
            description=c.description,
            change_type=c.change_type,
            triggered_by_insight_id=str(c.triggered_by_insight_id) if c.triggered_by_insight_id else None,
            expected_metric=c.expected_metric,
            expected_improvement_percent=c.expected_improvement_percent,
            implementation_status=c.implementation_status,
            implemented_at=c.implemented_at,
            actual_improvement_percent=c.actual_improvement_percent,
            result_status=c.result_status,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in changes
    ]


# Helper functions
def _journey_to_response(journey: Journey) -> JourneyResponse:
    return JourneyResponse(
        id=str(journey.id),
        organization_id=str(journey.organization_id),
        project_id=str(journey.project_id) if journey.project_id else None,
        target_group_id=str(journey.target_group_id) if journey.target_group_id else None,
        name=journey.name,
        description=journey.description,
        journey_type=journey.journey_type,
        creation_mode=journey.creation_mode.value,
        status=journey.status.value,
        validation_score=journey.validation_score,
        tracking_enabled=journey.tracking_enabled,
        created_at=journey.created_at,
        updated_at=journey.updated_at,
        created_by=journey.created_by,
        phases=[_phase_to_response(p) for p in journey.phases],
    )


def _phase_to_response(phase: JourneyPhase) -> PhaseResponse:
    return PhaseResponse(
        id=str(phase.id),
        journey_id=str(phase.journey_id),
        name=phase.name,
        description=phase.description,
        phase_order=phase.phase_order,
        expected_duration_min=phase.expected_duration_min,
        expected_duration_max=phase.expected_duration_max,
        duration_unit=phase.duration_unit,
        expected_emotion=phase.expected_emotion,
        emotion_intensity=phase.emotion_intensity,
        validation_score=phase.validation_score,
        validation_status=phase.validation_status,
        generated_by_ai=phase.generated_by_ai,
        generation_confidence=phase.generation_confidence,
        elements=[_element_to_response(e) for e in phase.elements],
        expectations=[_expectation_to_response(e) for e in phase.expectations],
    )


def _element_to_response(element: JourneyPhaseElement) -> ElementResponse:
    return ElementResponse(
        id=str(element.id),
        phase_id=str(element.phase_id),
        element_type=element.element_type.value,
        content=element.content,
        element_order=element.element_order,
        metadata=element.element_metadata,  # Use element_metadata attribute
        source_type=element.source_type,
        source_chunk_ids=element.source_chunk_ids,
        confidence=element.confidence,
    )


def _expectation_to_response(expectation: JourneyExpectation) -> ExpectationResponse:
    latest_measurement = None
    if expectation.measurements:
        latest = max(expectation.measurements, key=lambda m: m.synced_at)
        from ..schemas.journey import MeasurementSummary
        latest_measurement = MeasurementSummary(
            id=str(latest.id),
            actual_value=latest.actual_value,
            delta_percent=latest.delta_percent,
            status=latest.status.value,
            period_start=latest.period_start,
            period_end=latest.period_end,
            synced_at=latest.synced_at,
        )
    
    return ExpectationResponse(
        id=str(expectation.id),
        phase_id=str(expectation.phase_id),
        metric_type=expectation.metric_type.value,
        metric_name=expectation.metric_name,
        expected_value=expectation.expected_value,
        expected_value_max=expectation.expected_value_max,
        unit=expectation.unit,
        comparison=expectation.comparison.value,
        warning_threshold_percent=expectation.warning_threshold_percent,
        critical_threshold_percent=expectation.critical_threshold_percent,
        hypothesis=expectation.hypothesis,
        based_on_persona_id=str(expectation.based_on_persona_id) if expectation.based_on_persona_id else None,
        data_source=expectation.data_source,
        data_source_config=expectation.data_source_config,
        latest_measurement=latest_measurement,
    )

