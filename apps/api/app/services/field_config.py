"""
Zentrale Konfiguration für editierbare Felder aller Entitäten.

Diese Datei definiert, welche Felder für welche Entitäten editierbar sind
und welche Felder explizit erhalten bleiben sollen (auch wenn None).
"""

from __future__ import annotations

from typing import Dict, List

# Definiere editierbare Felder pro Entität
# Format: "entity_type": ["field1", "field2", "json_field.field_in_json", ...]
ENTITY_EDITABLE_FIELDS: Dict[str, List[str]] = {
    "persona": [
        # Basis-Felder (direkte Spalten)
        "name",
        "segment",
        "headline",
        # JSON-Feld: profile
        "profile.gender",
        "profile.age",
        "profile.location",
        "profile.media_affinity",
    ],
    "target_group": [
        "name",
        "segment",
        "description",
    ],
    # Zukünftig erweiterbar
    "document": [
        "filename",
        "insight_summary",
    ],
}

# Definiere Felder, die explizit erhalten bleiben sollen (auch bei None)
# Format: "entity_type": {"json_field_name": ["field1", "field2", ...]}
ENTITY_PRESERVED_FIELDS: Dict[str, Dict[str, List[str]]] = {
    "persona": {
        "profile": [  # Key = JSON-Feld-Name
            "gender",
            "age",
            "location",
            "media_affinity",
        ]
    },
    # Zukünftig: andere Entitäten
}


def get_editable_fields(entity_type: str) -> List[str]:
    """Gibt editierbare Felder für eine Entität zurück."""
    return ENTITY_EDITABLE_FIELDS.get(entity_type, [])


def get_preserved_fields(entity_type: str, json_field: str) -> List[str]:
    """Gibt preserved fields für ein JSON-Feld zurück."""
    return ENTITY_PRESERVED_FIELDS.get(entity_type, {}).get(json_field, [])

