from __future__ import annotations

import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_journey_api.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "test")
os.environ.setdefault("CLAUDE_API_KEY", "test-key")

from app.main import app
from app.models import Base
from app.db import engine

# Create test database
Base.metadata.create_all(bind=engine)

client = TestClient(app)


@pytest.fixture
def test_target_group():
    """Create a test target group."""
    from app.db import get_session
    from app.services.target_group_store import TargetGroupService
    
    service = TargetGroupService()
    with get_session() as session:
        from app.schemas import TargetGroupCreateRequest
        payload = TargetGroupCreateRequest(
            project_id=str(uuid4()),
            name="Test Target Group",
            segment="test",
        )
        tg = service.create_target_group(session, payload)
        return tg


def test_create_journey(test_target_group):
    """Test creating a journey."""
    response = client.post(
        "/journeys",
        json={
            "name": "Test Journey",
            "description": "Test description",
            "journey_type": "purchase",
            "creation_mode": "manual",
            "organization_id": str(uuid4()),
            "target_group_id": test_target_group.id,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Journey"
    assert data["journey_type"] == "purchase"
    assert data["target_group_id"] == test_target_group.id


def test_get_journey(test_target_group):
    """Test getting a journey."""
    # Create journey first
    create_response = client.post(
        "/journeys",
        json={
            "name": "Test Journey",
            "journey_type": "purchase",
            "creation_mode": "manual",
            "organization_id": str(uuid4()),
            "target_group_id": test_target_group.id,
        },
    )
    journey_id = create_response.json()["id"]
    
    # Get journey
    response = client.get(f"/journeys/{journey_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == journey_id
    assert data["name"] == "Test Journey"


def test_list_journeys(test_target_group):
    """Test listing journeys."""
    # Create a journey
    client.post(
        "/journeys",
        json={
            "name": "Test Journey",
            "journey_type": "purchase",
            "creation_mode": "manual",
            "organization_id": str(uuid4()),
            "target_group_id": test_target_group.id,
        },
    )
    
    # List journeys
    response = client.get(f"/journeys?target_group_id={test_target_group.id}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_create_phase(test_target_group):
    """Test creating a phase."""
    # Create journey first
    create_response = client.post(
        "/journeys",
        json={
            "name": "Test Journey",
            "journey_type": "purchase",
            "creation_mode": "manual",
            "organization_id": str(uuid4()),
            "target_group_id": test_target_group.id,
        },
    )
    journey_id = create_response.json()["id"]
    
    # Create phase
    response = client.post(
        f"/journeys/{journey_id}/phases",
        json={
            "name": "Phase 1",
            "description": "First phase",
            "phase_order": 1,
            "expected_duration_min": 5,
            "expected_duration_max": 10,
            "duration_unit": "minutes",
            "expected_emotion": "neutral",
            "emotion_intensity": 0.5,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Phase 1"
    assert data["phase_order"] == 1


def test_create_element(test_target_group):
    """Test creating an element."""
    # Create journey and phase
    journey_response = client.post(
        "/journeys",
        json={
            "name": "Test Journey",
            "journey_type": "purchase",
            "creation_mode": "manual",
            "organization_id": str(uuid4()),
            "target_group_id": test_target_group.id,
        },
    )
    journey_id = journey_response.json()["id"]
    
    phase_response = client.post(
        f"/journeys/{journey_id}/phases",
        json={
            "name": "Phase 1",
            "phase_order": 1,
        },
    )
    phase_id = phase_response.json()["id"]
    
    # Create element
    response = client.post(
        f"/journeys/{journey_id}/phases/{phase_id}/elements",
        json={
            "element_type": "action",
            "content": "User clicks button",
            "element_order": 1,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["element_type"] == "action"
    assert data["content"] == "User clicks button"


def test_create_expectation(test_target_group):
    """Test creating an expectation."""
    # Create journey and phase
    journey_response = client.post(
        "/journeys",
        json={
            "name": "Test Journey",
            "journey_type": "purchase",
            "creation_mode": "manual",
            "organization_id": str(uuid4()),
            "target_group_id": test_target_group.id,
        },
    )
    journey_id = journey_response.json()["id"]
    
    phase_response = client.post(
        f"/journeys/{journey_id}/phases",
        json={
            "name": "Phase 1",
            "phase_order": 1,
        },
    )
    phase_id = phase_response.json()["id"]
    
    # Create expectation
    response = client.post(
        f"/journeys/{journey_id}/phases/{phase_id}/expectations",
        json={
            "metric_type": "conversion_rate",
            "metric_name": "Sign-up Conversion",
            "expected_value": 0.4,
            "unit": "percent",
            "comparison": "greater_than",
            "data_source": "ga4",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["metric_type"] == "conversion_rate"
    assert data["expected_value"] == 0.4

