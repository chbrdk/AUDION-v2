from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# Base Schemas
class JourneyBase(BaseModel):
    name: str = Field(..., description="Journey name")
    description: Optional[str] = Field(default=None, description="Journey description")
    journey_type: str = Field(..., description="Type of journey (e.g., 'purchase', 'onboarding')")
    creation_mode: str = Field(..., description="Creation mode: manual, ai_generated, or hybrid")
    target_group_id: Optional[str] = Field(default=None, description="Target group ID this journey belongs to")
    project_id: Optional[str] = Field(default=None, description="Project ID")
    organization_id: str = Field(..., description="Organization ID")


class JourneyCreate(JourneyBase):
    created_by: Optional[str] = Field(default=None, description="User who created the journey")


class JourneyResponse(JourneyBase):
    id: str = Field(..., description="Journey ID")
    status: str = Field(..., description="Journey status: draft, active, validated, archived")
    validation_score: Optional[float] = Field(default=None, description="Overall validation score")
    tracking_enabled: bool = Field(default=False, description="Whether tracking is enabled")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    created_by: Optional[str] = Field(default=None, description="User who created the journey")
    phases: List["PhaseResponse"] = Field(default_factory=list, description="Journey phases")


# Phase Schemas
class PhaseBase(BaseModel):
    name: str = Field(..., description="Phase name")
    description: Optional[str] = Field(default=None, description="Phase description")
    phase_order: int = Field(..., description="Order of phase in journey")
    expected_duration_min: Optional[int] = Field(default=None, description="Minimum expected duration")
    expected_duration_max: Optional[int] = Field(default=None, description="Maximum expected duration")
    duration_unit: Optional[str] = Field(default="minutes", description="Duration unit: minutes, hours, days")
    expected_emotion: Optional[str] = Field(default=None, description="Expected emotion for this phase")
    emotion_intensity: Optional[float] = Field(default=None, description="Emotion intensity (0.0-1.0)")


class PhaseCreate(PhaseBase):
    url_pattern: Optional[Dict[str, Any]] = Field(default=None, description="URL patterns for tracking")
    form_id: Optional[Dict[str, Any]] = Field(default=None, description="Form IDs for tracking")
    event_names: Optional[Dict[str, Any]] = Field(default=None, description="Event names for tracking")


class PhaseResponse(PhaseBase):
    id: str = Field(..., description="Phase ID")
    journey_id: str = Field(..., description="Journey ID")
    validation_score: Optional[float] = Field(default=None, description="Phase validation score")
    validation_status: Optional[str] = Field(default=None, description="Validation status")
    generated_by_ai: bool = Field(default=False, description="Whether phase was AI-generated")
    generation_confidence: Optional[float] = Field(default=None, description="AI generation confidence")
    elements: List["ElementResponse"] = Field(default_factory=list, description="Phase elements")
    expectations: List["ExpectationResponse"] = Field(default_factory=list, description="Phase expectations")


# Element Schemas
class ElementCreate(BaseModel):
    element_type: str = Field(..., description="Element type: action, thought, feeling, touchpoint, pain_point, opportunity, question, quote")
    content: str = Field(..., description="Element content")
    element_order: int = Field(..., description="Order of element in phase")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")
    source_type: Optional[str] = Field(default=None, description="Source type")
    source_chunk_ids: Optional[List[str]] = Field(default=None, description="Source chunk IDs")
    confidence: Optional[float] = Field(default=None, description="Confidence score")


class ElementResponse(ElementCreate):
    id: str = Field(..., description="Element ID")
    phase_id: str = Field(..., description="Phase ID")


# Expectation Schemas
class ExpectationCreate(BaseModel):
    metric_type: str = Field(..., description="Metric type: sessions, users, page_views, etc.")
    metric_name: str = Field(..., description="Metric name")
    expected_value: Optional[float] = Field(default=None, description="Expected value")
    expected_value_max: Optional[float] = Field(default=None, description="Maximum expected value")
    unit: Optional[str] = Field(default=None, description="Unit of measurement")
    comparison: str = Field(..., description="Comparison operator: equals, greater_than, etc.")
    warning_threshold_percent: Optional[float] = Field(default=None, description="Warning threshold percentage")
    critical_threshold_percent: Optional[float] = Field(default=None, description="Critical threshold percentage")
    hypothesis: Optional[str] = Field(default=None, description="Hypothesis for this expectation")
    based_on_persona_id: Optional[str] = Field(default=None, description="Persona ID this expectation is based on")
    data_source: str = Field(..., description="Data source: ga4, hotjar, hubspot, custom")
    data_source_config: Optional[Dict[str, Any]] = Field(default=None, description="Data source configuration")


class ExpectationResponse(ExpectationCreate):
    id: str = Field(..., description="Expectation ID")
    phase_id: str = Field(..., description="Phase ID")
    latest_measurement: Optional["MeasurementSummary"] = Field(default=None, description="Latest measurement")


# Measurement Schemas
class MeasurementSummary(BaseModel):
    id: str = Field(..., description="Measurement ID")
    actual_value: float = Field(..., description="Actual measured value")
    delta_percent: Optional[float] = Field(default=None, description="Delta percentage")
    status: str = Field(..., description="Status: good, warning, critical, no_data")
    period_start: datetime = Field(..., description="Period start")
    period_end: datetime = Field(..., description="Period end")
    synced_at: datetime = Field(..., description="Sync timestamp")


class MeasurementResponse(MeasurementSummary):
    expectation_id: str = Field(..., description="Expectation ID")
    delta_absolute: Optional[float] = Field(default=None, description="Absolute delta")
    sample_size: Optional[int] = Field(default=None, description="Sample size")
    data_source: str = Field(..., description="Data source")
    raw_data: Optional[Dict[str, Any]] = Field(default=None, description="Raw data")


# Validation Schemas
class JourneyGenerateRequest(BaseModel):
    target_group_id: str = Field(..., description="Target group ID to generate journey for")
    journey_type: str = Field(..., description="Type of journey (e.g., 'customer_acquisition', 'customer_onboarding')")
    organization_id: str = Field(..., description="Organization ID")
    project_id: Optional[str] = Field(default=None, description="Project ID (optional)")
    created_by: Optional[str] = Field(default=None, description="User who is generating the journey")
    use_async: bool = Field(default=False, description="Whether to generate asynchronously via Celery task")


class ValidationRequest(BaseModel):
    persona_ids: List[str] = Field(..., description="List of persona IDs to validate against")
    mode: str = Field(default="automated", description="Validation mode: chat, automated, or both")


class FrictionPoint(BaseModel):
    description: str = Field(..., description="Description of friction point")
    severity: str = Field(..., description="Severity: low, medium, high")
    persona_quote: Optional[str] = Field(default=None, description="Quote from persona perspective")


class PhaseValidationResult(BaseModel):
    phase_id: str = Field(..., description="Phase ID")
    phase_name: str = Field(..., description="Phase name")
    fit_score: float = Field(..., description="Fit score (0-100)")
    status: str = Field(..., description="Status: good, warning, critical")
    friction_points: List[FrictionPoint] = Field(default_factory=list, description="Friction points")
    recommendations: List[str] = Field(default_factory=list, description="Recommendations")


class JourneyValidationReport(BaseModel):
    journey_id: str = Field(..., description="Journey ID")
    overall_fit_score: float = Field(..., description="Overall fit score (0-100)")
    phases: List[PhaseValidationResult] = Field(..., description="Phase validation results")
    validated_at: datetime = Field(..., description="Validation timestamp")


# Insight Schemas
class InsightResponse(BaseModel):
    id: str = Field(..., description="Insight ID")
    journey_id: str = Field(..., description="Journey ID")
    phase_id: Optional[str] = Field(default=None, description="Phase ID")
    expectation_id: Optional[str] = Field(default=None, description="Expectation ID")
    insight_type: str = Field(..., description="Insight type: confirmation, contradiction, discovery, anomaly")
    title: str = Field(..., description="Insight title")
    description: Optional[str] = Field(default=None, description="Insight description")
    ai_analysis: Optional[Dict[str, Any]] = Field(default=None, description="AI analysis")
    ai_recommendations: Optional[List[str]] = Field(default=None, description="AI recommendations")
    evidence: Optional[Dict[str, Any]] = Field(default=None, description="Evidence")
    confidence: Optional[float] = Field(default=None, description="Confidence score")
    priority: Optional[float] = Field(default=None, description="Priority score")
    status: str = Field(..., description="Status: new, acknowledged, actioned, dismissed")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Update timestamp")


# Change Schemas
class ChangeResponse(BaseModel):
    id: str = Field(..., description="Change ID")
    journey_id: str = Field(..., description="Journey ID")
    phase_id: Optional[str] = Field(default=None, description="Phase ID")
    title: str = Field(..., description="Change title")
    description: Optional[str] = Field(default=None, description="Change description")
    change_type: str = Field(..., description="Change type")
    triggered_by_insight_id: Optional[str] = Field(default=None, description="Insight ID that triggered this change")
    expected_metric: Optional[str] = Field(default=None, description="Expected metric")
    expected_improvement_percent: Optional[float] = Field(default=None, description="Expected improvement percentage")
    implementation_status: Optional[str] = Field(default=None, description="Implementation status")
    implemented_at: Optional[datetime] = Field(default=None, description="Implementation timestamp")
    actual_improvement_percent: Optional[float] = Field(default=None, description="Actual improvement percentage")
    result_status: Optional[str] = Field(default=None, description="Result status")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Update timestamp")


# AI Assistance Schemas
class JourneyAiGenerateRequest(BaseModel):
    template_id: str = Field(..., description="Template to use (e.g., 'journey_moments', 'phase_expectations')")
    phase_id: Optional[str] = Field(default=None, description="Phase ID (if existing)")
    phase_context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional context for the phase (name, description, emotion, etc.)",
    )
    prompt_variables: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional variables to override prompt defaults (e.g., max_items)",
    )
    max_suggestions: int = Field(default=3, ge=1, le=10, description="Maximum number of suggestions to return")


class JourneyAiSuggestion(BaseModel):
    element_type: Optional[str] = Field(default=None, description="Suggested element type")
    title: Optional[str] = Field(default=None, description="Optional title/label")
    content: str = Field(..., description="Suggestion content")


class JourneyAiGenerationResponse(BaseModel):
    template_id: str = Field(..., description="Template that produced these suggestions")
    suggestions: List[JourneyAiSuggestion] = Field(default_factory=list, description="Generated suggestions")
    raw_output: str = Field(..., description="Raw text returned from the LLM")


# Update forward references
JourneyResponse.model_rebuild()
PhaseResponse.model_rebuild()
ExpectationResponse.model_rebuild()

