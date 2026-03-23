"""Shared serializer: Journey model -> JourneyResponse. Used by journeys router and projects router."""
from __future__ import annotations

from ..models import Journey, JourneyPhase, JourneyPhaseElement, JourneyExpectation
from ..schemas.journey import (
    ElementResponse,
    ExpectationResponse,
    JourneyResponse,
    MeasurementSummary,
    PhaseResponse,
)


def _element_to_response(element: JourneyPhaseElement) -> ElementResponse:
    return ElementResponse(
        id=str(element.id),
        phase_id=str(element.phase_id),
        element_type=element.element_type.value,
        content=element.content,
        element_order=element.element_order,
        metadata=element.element_metadata,
        source_type=element.source_type,
        source_chunk_ids=element.source_chunk_ids,
        confidence=element.confidence,
    )


def _expectation_to_response(expectation: JourneyExpectation) -> ExpectationResponse:
    latest_measurement = None
    if expectation.measurements:
        latest = max(expectation.measurements, key=lambda m: m.synced_at)
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


def phase_to_response(phase: JourneyPhase) -> PhaseResponse:
    """Serialize one phase for POST/PUT /journeys/.../phases responses."""
    return _phase_to_response(phase)


def to_journey_response(journey: Journey) -> JourneyResponse:
    """Build JourneyResponse from a Journey model (phases, elements, expectations must be loaded)."""
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
