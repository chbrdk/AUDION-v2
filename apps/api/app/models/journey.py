from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from ..db import Base


class JourneyCreationMode(PyEnum):
    manual = "manual"
    ai_generated = "ai_generated"
    hybrid = "hybrid"


class JourneyStatus(PyEnum):
    draft = "draft"
    active = "active"
    validated = "validated"
    archived = "archived"


class JourneyElementType(PyEnum):
    action = "action"
    thought = "thought"
    feeling = "feeling"
    touchpoint = "touchpoint"
    pain_point = "pain_point"
    opportunity = "opportunity"
    question = "question"
    quote = "quote"


class JourneyMetricType(PyEnum):
    sessions = "sessions"
    users = "users"
    page_views = "page_views"
    bounce_rate = "bounce_rate"
    time_on_page = "time_on_page"
    scroll_depth = "scroll_depth"
    engagement_rate = "engagement_rate"
    conversion_rate = "conversion_rate"
    form_submissions = "form_submissions"
    cta_clicks = "cta_clicks"
    cta_click_rate = "cta_click_rate"
    rage_clicks = "rage_clicks"
    u_turns = "u_turns"
    error_clicks = "error_clicks"
    leads = "leads"
    opportunities = "opportunities"
    revenue = "revenue"


class JourneyComparisonOperator(PyEnum):
    equals = "equals"
    not_equals = "not_equals"
    greater_than = "greater_than"
    less_than = "less_than"
    greater_or_equal = "greater_or_equal"
    less_or_equal = "less_or_equal"
    between = "between"


class JourneyMeasurementStatus(PyEnum):
    good = "good"
    warning = "warning"
    critical = "critical"
    no_data = "no_data"


class JourneyInsightType(PyEnum):
    confirmation = "confirmation"
    contradiction = "contradiction"
    discovery = "discovery"
    anomaly = "anomaly"


class JourneyInsightStatus(PyEnum):
    new = "new"
    acknowledged = "acknowledged"
    actioned = "actioned"
    dismissed = "dismissed"


class Journey(Base):
    __tablename__ = "journeys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=True)
    target_group_id = Column(UUID(as_uuid=True), ForeignKey("target_groups.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    journey_type = Column(String(128), nullable=False)
    creation_mode = Column(
        Enum(JourneyCreationMode, name="journey_creation_mode"),
        nullable=False,
    )
    status = Column(
        Enum(JourneyStatus, name="journey_status"),
        default=JourneyStatus.draft,
        nullable=False,
    )
    validation_score = Column(Float, nullable=True)
    tracking_enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String(128), nullable=True)

    target_group = relationship("TargetGroup", back_populates="journeys")
    phases = relationship(
        "JourneyPhase",
        back_populates="journey",
        cascade="all, delete-orphan",
        order_by="JourneyPhase.phase_order",
    )
    insights = relationship("JourneyInsight", back_populates="journey")
    changes = relationship("JourneyChange", back_populates="journey")


class JourneyPhase(Base):
    __tablename__ = "journey_phases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    journey_id = Column(UUID(as_uuid=True), ForeignKey("journeys.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    phase_order = Column(Integer, nullable=False)
    expected_duration_min = Column(Integer, nullable=True)
    expected_duration_max = Column(Integer, nullable=True)
    duration_unit = Column(String(32), nullable=True, default="minutes")
    expected_emotion = Column(String(64), nullable=True)
    emotion_intensity = Column(Float, nullable=True)
    url_pattern = Column(JSONB, nullable=True)
    form_id = Column(JSONB, nullable=True)
    event_names = Column(JSONB, nullable=True)
    validation_status = Column(String(64), nullable=True)
    validation_score = Column(Float, nullable=True)
    generated_by_ai = Column(Boolean, nullable=False, default=False)
    generation_confidence = Column(Float, nullable=True)
    source_chunks = Column(JSONB, nullable=True)

    journey = relationship("Journey", back_populates="phases")
    elements = relationship(
        "JourneyPhaseElement",
        back_populates="phase",
        cascade="all, delete-orphan",
        order_by="JourneyPhaseElement.element_order",
    )
    expectations = relationship("JourneyExpectation", back_populates="phase", cascade="all, delete-orphan")
    measurements = relationship("JourneyMeasurement", back_populates="phase", cascade="all, delete-orphan")


class JourneyPhaseElement(Base):
    __tablename__ = "journey_phase_elements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    phase_id = Column(UUID(as_uuid=True), ForeignKey("journey_phases.id", ondelete="CASCADE"), nullable=False)
    element_type = Column(
        Enum(JourneyElementType, name="journey_element_type"),
        nullable=False,
    )
    content = Column(Text, nullable=False)
    element_order = Column(Integer, nullable=False)
    element_metadata = Column("metadata", JSONB, nullable=True)  # Column name is "metadata", attribute is "element_metadata"
    source_type = Column(String(64), nullable=True)
    source_chunk_ids = Column(JSONB, nullable=True)
    confidence = Column(Float, nullable=True)

    phase = relationship("JourneyPhase", back_populates="elements")


class JourneyExpectation(Base):
    __tablename__ = "journey_expectations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    phase_id = Column(UUID(as_uuid=True), ForeignKey("journey_phases.id", ondelete="CASCADE"), nullable=False)
    metric_type = Column(
        Enum(JourneyMetricType, name="journey_metric_type"),
        nullable=False,
    )
    metric_name = Column(String(128), nullable=False)
    expected_value = Column(Float, nullable=True)
    expected_value_max = Column(Float, nullable=True)
    unit = Column(String(32), nullable=True)
    comparison = Column(
        Enum(JourneyComparisonOperator, name="journey_comparison_operator"),
        nullable=False,
    )
    warning_threshold_percent = Column(Float, nullable=True)
    critical_threshold_percent = Column(Float, nullable=True)
    hypothesis = Column(Text, nullable=True)
    based_on_persona_id = Column(UUID(as_uuid=True), ForeignKey("personas.id", ondelete="SET NULL"), nullable=True)
    data_source = Column(String(64), nullable=False)
    data_source_config = Column(JSONB, nullable=True)

    phase = relationship("JourneyPhase", back_populates="expectations")
    persona = relationship("Persona")
    measurements = relationship("JourneyMeasurement", back_populates="expectation", cascade="all, delete-orphan")


class JourneyMeasurement(Base):
    __tablename__ = "journey_measurements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    expectation_id = Column(UUID(as_uuid=True), ForeignKey("journey_expectations.id", ondelete="CASCADE"), nullable=False)
    phase_id = Column(UUID(as_uuid=True), ForeignKey("journey_phases.id", ondelete="CASCADE"), nullable=True)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    actual_value = Column(Float, nullable=False)
    delta_absolute = Column(Float, nullable=True)
    delta_percent = Column(Float, nullable=True)
    status = Column(
        Enum(JourneyMeasurementStatus, name="journey_measurement_status"),
        nullable=False,
    )
    sample_size = Column(Integer, nullable=True)
    data_source = Column(String(64), nullable=False)
    raw_data = Column(JSONB, nullable=True)
    synced_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    expectation = relationship("JourneyExpectation", back_populates="measurements")
    phase = relationship("JourneyPhase", back_populates="measurements")


class JourneyInsight(Base):
    __tablename__ = "journey_insights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    journey_id = Column(UUID(as_uuid=True), ForeignKey("journeys.id", ondelete="CASCADE"), nullable=False)
    phase_id = Column(UUID(as_uuid=True), ForeignKey("journey_phases.id", ondelete="SET NULL"), nullable=True)
    expectation_id = Column(UUID(as_uuid=True), ForeignKey("journey_expectations.id", ondelete="SET NULL"), nullable=True)
    insight_type = Column(
        Enum(JourneyInsightType, name="journey_insight_type"),
        nullable=False,
    )
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    ai_analysis = Column(JSONB, nullable=True)
    ai_recommendations = Column(JSONB, nullable=True)
    evidence = Column(JSONB, nullable=True)
    confidence = Column(Float, nullable=True)
    priority = Column(Float, nullable=True)
    status = Column(
        Enum(JourneyInsightStatus, name="journey_insight_status"),
        default=JourneyInsightStatus.new,
        nullable=False,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    journey = relationship("Journey", back_populates="insights")
    phase = relationship("JourneyPhase")
    expectation = relationship("JourneyExpectation")


class JourneyChange(Base):
    __tablename__ = "journey_changes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    journey_id = Column(UUID(as_uuid=True), ForeignKey("journeys.id", ondelete="CASCADE"), nullable=False)
    phase_id = Column(UUID(as_uuid=True), ForeignKey("journey_phases.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    change_type = Column(String(64), nullable=False)
    triggered_by_insight_id = Column(UUID(as_uuid=True), ForeignKey("journey_insights.id", ondelete="SET NULL"), nullable=True)
    expected_metric = Column(String(128), nullable=True)
    expected_improvement_percent = Column(Float, nullable=True)
    implementation_status = Column(String(64), nullable=True)
    implemented_at = Column(DateTime, nullable=True)
    actual_improvement_percent = Column(Float, nullable=True)
    result_status = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    journey = relationship("Journey", back_populates="changes")
    phase = relationship("JourneyPhase")
    triggered_by_insight = relationship("JourneyInsight")

