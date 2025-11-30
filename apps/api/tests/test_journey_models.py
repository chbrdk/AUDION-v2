from __future__ import annotations

import os
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_journey.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "test")
os.environ.setdefault("CLAUDE_API_KEY", "test-key")

from app.models import (
    Base,
    Journey,
    JourneyPhase,
    JourneyPhaseElement,
    JourneyExpectation,
    JourneyCreationMode,
    JourneyStatus,
    JourneyElementType,
    JourneyMetricType,
    JourneyComparisonOperator,
    TargetGroup,
)


def build_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def test_journey_defaults():
    """Test that Journey model has correct defaults."""
    session = build_session()
    journey = Journey(
        organization_id=uuid4(),
        name="Test Journey",
        journey_type="purchase",
        creation_mode=JourneyCreationMode.manual,
    )
    session.add(journey)
    session.commit()

    assert journey.status == JourneyStatus.draft
    assert journey.tracking_enabled is False
    assert journey.validation_score is None
    assert journey.created_at is not None
    assert journey.updated_at is not None


def test_journey_target_group_relationship():
    """Test that Journey can be linked to TargetGroup."""
    session = build_session()
    
    # Create target group
    target_group = TargetGroup(
        project_id=uuid4(),
        name="Enterprise Buyers",
        segment="enterprise",
    )
    session.add(target_group)
    session.commit()
    
    # Create journey
    journey = Journey(
        organization_id=uuid4(),
        name="Enterprise Purchase Journey",
        journey_type="purchase",
        creation_mode=JourneyCreationMode.manual,
        target_group_id=target_group.id,
    )
    session.add(journey)
    session.commit()
    
    assert journey.target_group_id == target_group.id
    assert journey.target_group.name == "Enterprise Buyers"
    assert len(target_group.journeys) == 1


def test_journey_phase_relationship():
    """Test that Journey has phases with correct ordering."""
    session = build_session()
    
    journey = Journey(
        organization_id=uuid4(),
        name="Test Journey",
        journey_type="onboarding",
        creation_mode=JourneyCreationMode.manual,
    )
    session.add(journey)
    session.commit()
    
    # Create phases
    phase1 = JourneyPhase(
        journey_id=journey.id,
        name="Phase 1",
        phase_order=1,
    )
    phase2 = JourneyPhase(
        journey_id=journey.id,
        name="Phase 2",
        phase_order=2,
    )
    session.add_all([phase1, phase2])
    session.commit()
    
    session.refresh(journey)
    assert len(journey.phases) == 2
    assert journey.phases[0].phase_order == 1
    assert journey.phases[1].phase_order == 2


def test_journey_phase_elements():
    """Test that Phase has elements."""
    session = build_session()
    
    journey = Journey(
        organization_id=uuid4(),
        name="Test Journey",
        journey_type="onboarding",
        creation_mode=JourneyCreationMode.manual,
    )
    session.add(journey)
    session.commit()
    
    phase = JourneyPhase(
        journey_id=journey.id,
        name="Phase 1",
        phase_order=1,
    )
    session.add(phase)
    session.commit()
    
    element = JourneyPhaseElement(
        phase_id=phase.id,
        element_type=JourneyElementType.action,
        content="User clicks sign up button",
        element_order=1,
    )
    session.add(element)
    session.commit()
    
    session.refresh(phase)
    assert len(phase.elements) == 1
    assert phase.elements[0].element_type == JourneyElementType.action


def test_journey_expectation_persona_relationship():
    """Test that Expectation can reference Persona."""
    from app.models import Persona
    
    session = build_session()
    
    # Create persona
    persona = Persona(
        project_id=uuid4(),
        name="Test Persona",
        segment="test",
        headline="Test",
        profile={"bio": "Test"},
        confidence=0.9,
        version="1.0.0",
    )
    session.add(persona)
    session.commit()
    
    # Create journey and phase
    journey = Journey(
        organization_id=uuid4(),
        name="Test Journey",
        journey_type="purchase",
        creation_mode=JourneyCreationMode.manual,
    )
    session.add(journey)
    session.commit()
    
    phase = JourneyPhase(
        journey_id=journey.id,
        name="Phase 1",
        phase_order=1,
    )
    session.add(phase)
    session.commit()
    
    # Create expectation with persona reference
    expectation = JourneyExpectation(
        phase_id=phase.id,
        metric_type=JourneyMetricType.conversion_rate,
        metric_name="Sign-up Conversion",
        expected_value=0.4,
        comparison=JourneyComparisonOperator.greater_than,
        data_source="ga4",
        based_on_persona_id=persona.id,
    )
    session.add(expectation)
    session.commit()
    
    assert expectation.based_on_persona_id == persona.id
    assert expectation.persona.name == "Test Persona"


def test_journey_cascade_delete():
    """Test that deleting journey deletes phases and elements."""
    session = build_session()
    
    journey = Journey(
        organization_id=uuid4(),
        name="Test Journey",
        journey_type="onboarding",
        creation_mode=JourneyCreationMode.manual,
    )
    session.add(journey)
    session.commit()
    
    phase = JourneyPhase(
        journey_id=journey.id,
        name="Phase 1",
        phase_order=1,
    )
    session.add(phase)
    session.commit()
    
    element = JourneyPhaseElement(
        phase_id=phase.id,
        element_type=JourneyElementType.action,
        content="Test",
        element_order=1,
    )
    session.add(element)
    session.commit()
    
    # Delete journey
    session.delete(journey)
    session.commit()
    
    # Check that phase and element are deleted
    assert session.get(JourneyPhase, phase.id) is None
    assert session.get(JourneyPhaseElement, element.id) is None

