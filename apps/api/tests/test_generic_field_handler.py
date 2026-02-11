"""
Tests für GenericFieldHandler.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from app.services.field_config import get_preserved_fields
from app.services.generic_field_handler import GenericFieldHandler


class MockProfile(BaseModel):
    """Test Pydantic model ähnlich PersonaProfile."""

    name: str
    gender: Optional[str] = None
    age: Optional[int] = None
    location: Optional[str] = None
    media_affinity: Optional[int] = None
    full_name: Optional[str] = None


class MockEntity:
    """Mock SQLAlchemy entity."""

    def __init__(self, profile: dict | None = None):
        self.profile = profile or {}


class TestGenericFieldHandler:
    """Tests für GenericFieldHandler."""

    def test_merge_json_updates_preserves_none_values(self):
        """Teste, dass None-Werte beim Merge erhalten bleiben."""
        handler = GenericFieldHandler(entity_type="persona", json_fields=["profile"])

        existing = {
            "name": "Test",
            "gender": "male",
            "age": 30,
        }

        updates = {
            "gender": None,  # Explizit auf None setzen
            "age": 25,
            "location": "Berlin",
        }

        preserve_fields = ["gender", "age", "location", "media_affinity", "full_name"]

        merged = handler.merge_json_updates(existing, updates, preserve_fields=preserve_fields)

        assert merged["name"] == "Test"  # Bestehendes Feld bleibt
        assert merged["gender"] is None  # None-Wert wurde explizit gesetzt
        assert merged["age"] == 25  # Update überschreibt
        assert merged["location"] == "Berlin"  # Neues Feld hinzugefügt

    def test_merge_json_updates_preserves_all_fields(self):
        """Teste, dass preserve_fields immer gesetzt werden."""
        handler = GenericFieldHandler(entity_type="persona", json_fields=["profile"])

        existing = {}
        updates = {"name": "Test"}

        preserve_fields = ["gender", "age", "location"]

        merged = handler.merge_json_updates(existing, updates, preserve_fields=preserve_fields)

        # preserve_fields sollten nicht automatisch hinzugefügt werden,
        # wenn sie nicht in updates sind
        assert "name" in merged
        # Wenn preserve_fields in updates sind, werden sie gesetzt
        assert "gender" not in merged or merged.get("gender") is None

    def test_extract_fields_from_pydantic_includes_none(self):
        """Teste, dass None-Werte aus Pydantic-Modell extrahiert werden."""
        handler = GenericFieldHandler(entity_type="persona", json_fields=["profile"])

        # Erstelle Model mit None-Werten
        model = MockProfile(
            name="Test",
            gender=None,
            age=None,
            location="Berlin",
            media_affinity=24,
            full_name=None,
        )

        field_names = ["gender", "age", "location", "media_affinity", "full_name"]
        extracted = handler.extract_fields_from_pydantic(model, field_names)

        # Alle Felder sollten extrahiert werden, auch wenn None
        assert "gender" in extracted
        assert extracted["gender"] is None
        assert "age" in extracted
        assert extracted["age"] is None
        assert extracted["location"] == "Berlin"
        assert extracted["media_affinity"] == 24
        assert "full_name" in extracted
        assert extracted["full_name"] is None

    def test_extract_fields_from_pydantic_handles_missing_fields(self):
        """Teste Extraktion wenn Feld nicht im Model vorhanden ist."""
        handler = GenericFieldHandler(entity_type="persona", json_fields=["profile"])

        model = MockProfile(name="Test")

        field_names = ["gender", "nonexistent"]
        extracted = handler.extract_fields_from_pydantic(model, field_names)

        # gender sollte None sein (im Model definiert)
        assert "gender" in extracted
        assert extracted["gender"] is None
        # nonexistent sollte nicht extrahiert werden
        assert "nonexistent" not in extracted

    def test_apply_updates_to_entity_json_field(self):
        """Teste Anwendung von Updates auf JSON-Feld."""
        handler = GenericFieldHandler(
            entity_type="persona",
            json_fields=["profile"],
            preserved_fields=["gender", "age"],
        )

        entity = MockEntity(profile={"name": "Test", "gender": "male"})

        updates = {
            "profile": {
                "gender": None,
                "age": 30,
                "location": "Berlin",
            }
        }

        preserve_fields = get_preserved_fields("persona", "profile")

        handler.apply_updates_to_entity(
            entity,
            updates,
            json_field_preserve_fields={"profile": preserve_fields},
        )

        # Profile sollte gemerged sein
        assert entity.profile["name"] == "Test"  # Bestehendes Feld bleibt
        assert entity.profile["gender"] is None  # None-Wert wurde gesetzt
        assert entity.profile["age"] == 30
        assert entity.profile["location"] == "Berlin"

    def test_apply_updates_to_entity_simple_field(self):
        """Teste Anwendung von Updates auf einfache Felder."""
        handler = GenericFieldHandler(entity_type="target_group", json_fields=[])

        entity = MockEntity()
        entity.name = "Old Name"

        handler.apply_updates_to_entity(entity, {"name": "New Name"})

        assert entity.name == "New Name"

    def test_merge_with_empty_existing(self):
        """Teste Merge mit leerem bestehenden Profil."""
        handler = GenericFieldHandler(entity_type="persona", json_fields=["profile"])

        existing = {}
        updates = {"gender": None, "age": 25}

        preserve_fields = ["gender", "age"]

        merged = handler.merge_json_updates(existing, updates, preserve_fields=preserve_fields)

        assert merged["gender"] is None
        assert merged["age"] == 25

    def test_merge_with_empty_updates(self):
        """Teste Merge mit leeren Updates (bestehende Felder bleiben)."""
        handler = GenericFieldHandler(entity_type="persona", json_fields=["profile"])

        existing = {"name": "Test", "gender": "male"}
        updates = {}

        preserve_fields = ["gender"]

        merged = handler.merge_json_updates(existing, updates, preserve_fields=preserve_fields)

        assert merged["name"] == "Test"
        assert merged["gender"] == "male"

