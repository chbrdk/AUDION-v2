from __future__ import annotations

import os
from uuid import uuid4

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_journey_gen.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "test")
os.environ.setdefault("CLAUDE_API_KEY", "test-key")

from app.services.journey_generation import JourneyGenerationService, JourneyDraft


@pytest.mark.asyncio
async def test_journey_generation_service_initialization():
    """Test that JourneyGenerationService initializes correctly."""
    service = JourneyGenerationService()
    assert service.retrieval_agent is not None
    assert service.persona_service is not None
    assert service.target_group_service is not None


def test_save_journey_draft():
    """Test saving a journey draft to database."""
    from app.db import get_session

    service = JourneyGenerationService()

    draft = JourneyDraft(
        name="Test Journey",
        description="Test description",
        journey_type="purchase",
        phases=[],
    )

    journey = service.save_journey_draft(
        draft=draft,
        target_group_id=uuid4(),
        organization_id=uuid4(),
        project_id=None,
        created_by="test_user",
    )

    assert journey.name == "Test Journey"
    assert journey.journey_type == "purchase"
    assert journey.creation_mode.value == "ai_generated"

    # Cleanup
    with get_session() as session:
        session.delete(journey)
        session.commit()


def test_save_journey_draft_without_target_group():
    """Test saving a journey draft with target_group_id=None (project-only generation)."""
    from app.db import get_session

    service = JourneyGenerationService()
    org_id = uuid4()
    project_id = uuid4()

    draft = JourneyDraft(
        name="Project-only Journey",
        description="From company context only",
        journey_type="customer_journey",
        phases=[{"name": "Phase 1", "description": "First", "phase_order": 1, "elements": []}],
    )

    journey = service.save_journey_draft(
        draft=draft,
        target_group_id=None,
        organization_id=org_id,
        project_id=project_id,
        created_by="test_user",
    )

    assert journey.name == "Project-only Journey"
    assert journey.target_group_id is None
    assert journey.project_id == project_id
    assert journey.organization_id == org_id

    with get_session() as session:
        session.delete(journey)
        session.commit()

