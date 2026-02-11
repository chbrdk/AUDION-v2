from __future__ import annotations

import os
from uuid import uuid4

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_journey_val.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "test")
os.environ.setdefault("CLAUDE_API_KEY", "test-key")

from app.services.journey_validation import JourneyValidationService
from app.models import JourneyPhase
from msqdx_glass_proto import PersonaProfile


@pytest.mark.asyncio
async def test_validation_service_initialization():
    """Test that JourneyValidationService initializes correctly."""
    service = JourneyValidationService()
    assert service.persona_service is not None
    assert service.target_group_service is not None


def test_calculate_fit_score():
    """Test fit score calculation."""
    
    service = JourneyValidationService()
    
    # Create a test phase
    phase = JourneyPhase(
        journey_id=uuid4(),
        name="Test Phase",
        phase_order=1,
        expected_emotion="neutral",
        emotion_intensity=0.5,
    )
    
    # Create a test persona profile
    profile = PersonaProfile(
        persona_id=str(uuid4()),
        source_id="test",
        provenance="internal",
        segment="test",
        demographics={},
        traits={"analytical": 0.8, "cautious": 0.6},
        goals=[{"label": "Find best solution", "priority": 1}],
        pain_points=[{"label": "Time constraints", "evidence_count": 5}],
        behaviors=["Research thoroughly", "Compare options"],
    )
    
    score = service.calculate_fit_score(phase, profile)
    assert 0 <= score <= 100


def test_identify_friction_points():
    """Test friction point identification."""
    
    service = JourneyValidationService()
    
    phase = JourneyPhase(
        journey_id=uuid4(),
        name="Test Phase",
        phase_order=1,
        expected_emotion="frustrated",
        emotion_intensity=0.8,
    )
    
    profile = PersonaProfile(
        persona_id=str(uuid4()),
        source_id="test",
        provenance="internal",
        segment="test",
        demographics={},
        traits={"patient": 0.9, "calm": 0.8},
        goals=[],
        pain_points=[],
        behaviors=[],
    )
    
    friction_points = service.identify_friction_points(phase, profile)
    assert isinstance(friction_points, list)
    # Should identify emotion mismatch
    assert len(friction_points) > 0


def test_generate_recommendations():
    """Test recommendation generation."""
    
    service = JourneyValidationService()
    
    phase = JourneyPhase(
        journey_id=uuid4(),
        name="Test Phase",
        phase_order=1,
    )
    
    profile = PersonaProfile(
        persona_id=str(uuid4()),
        source_id="test",
        provenance="internal",
        segment="test",
        demographics={},
        traits={},
        goals=[],
        pain_points=[],
        behaviors=[],
    )
    
    recommendations = service.generate_recommendations(phase, profile, 45.0)
    assert isinstance(recommendations, list)
    # Low score should generate recommendations
    assert len(recommendations) > 0

