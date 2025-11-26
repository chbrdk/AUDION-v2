"""
Generischer Handler für Feld-Updates aller Entitäten.

Diese Klasse kann für alle Entitäten verwendet werden, die:
- JSON/JSONB Spalten haben
- Einfache Spalten haben
- Kombinationen davon haben
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Optional

from sqlalchemy.orm.attributes import flag_modified


class GenericFieldHandler:
    """
    Generischer Handler für Feld-Updates.
    
    Diese Klasse kann für alle Entitäten verwendet werden, die:
    - JSON/JSONB Spalten haben
    - Einfache Spalten haben
    - Kombinationen davon haben
    """

    def __init__(
        self,
        entity_type: str,
        json_fields: Optional[List[str]] = None,
        nullable_json_fields: Optional[List[str]] = None,
        preserved_fields: Optional[List[str]] = None,
    ):
        """
        Args:
            entity_type: Name der Entität (z.B. "persona", "target_group")
            json_fields: Liste der JSON/JSONB Spalten-Namen
            nullable_json_fields: JSON-Felder, die None sein können
            preserved_fields: Felder, die beim Merge immer erhalten bleiben sollen
        """
        self.entity_type = entity_type
        self.json_fields = json_fields or []
        self.nullable_json_fields = nullable_json_fields or []
        self.preserved_fields = preserved_fields or []

    def merge_json_updates(
        self,
        existing: Dict[str, Any],
        updates: Dict[str, Any],
        preserve_fields: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Merged JSON-Updates sicher zusammen.

        Regeln:
        1. Bestehende Felder bleiben erhalten
        2. Updates überschreiben bestehende
        3. preserve_fields werden IMMER aus updates genommen (auch wenn None)
        4. None-Werte werden explizit gespeichert

        Args:
            existing: Bestehendes JSON-Dict aus DB
            updates: Neue Updates vom Request
            preserve_fields: Felder, die explizit erhalten bleiben sollen (z.B. demografische Felder)

        Returns:
            Gemergtes Dict
        """
        preserve_fields = preserve_fields or []
        merged = deepcopy(existing or {})

        # Überschreibe mit allen Updates
        merged.update(updates)

        # WICHTIG: Für preserve_fields, explizit setzen (auch wenn None)
        # Das stellt sicher, dass None-Werte nicht verloren gehen
        # Setze preserve_fields IMMER explizit, auch wenn sie in updates sind
        for field in preserve_fields:
            # Wenn preserve_field in updates ist, nutze diesen Wert (kann None sein)
            if field in updates:
                merged[field] = updates[field]  # Kann None sein
            # Falls preserve_field nicht in updates, aber in existing war, behalte es
            elif field in existing:
                # Behalte den existing Wert (auch wenn None)
                merged[field] = existing[field]
            # Wenn preserve_field weder in updates noch in existing, setze explizit auf None
            else:
                merged[field] = None

        return merged

    def extract_fields_from_pydantic(
        self,
        model_instance: Any,
        field_names: List[str],
    ) -> Dict[str, Any]:
        """
        Extrahiert Felder aus einem Pydantic-Modell.

        Diese Funktion stellt sicher, dass ALLE Felder extrahiert werden,
        einschließlich None-Werte.

        Args:
            model_instance: Pydantic-Modell-Instanz
            field_names: Liste der Feld-Namen zum Extrahieren

        Returns:
            Dict mit allen extrahierten Feldern
        """
        result = {}

        # Hole alle Felder aus model_dump
        model_dump = model_instance.model_dump(exclude_none=False, exclude_unset=False)

        # Für spezifische Felder: Hole direkt aus Attributen
        for field_name in field_names:
            if hasattr(model_instance, field_name):
                attr_value = getattr(model_instance, field_name)
                result[field_name] = attr_value  # Kann None sein
            elif field_name in model_dump:
                result[field_name] = model_dump[field_name]

        return result

    def apply_updates_to_entity(
        self,
        entity: Any,  # SQLAlchemy Model
        updates: Dict[str, Any],
        json_field_preserve_fields: Optional[Dict[str, List[str]]] = None,
    ) -> None:
        """
        Wendet Updates auf eine SQLAlchemy-Entität an.

        Args:
            entity: SQLAlchemy Model-Instanz
            updates: Dict mit Updates (Key = Spalten-Name oder JSON-Pfad)
            json_field_preserve_fields: Dict mapping JSON-Feld-Namen zu Liste der preserve_fields
                                       z.B. {"profile": ["gender", "age", "location"]}
        """
        json_field_preserve_fields = json_field_preserve_fields or {}

        for field_name, value in updates.items():
            # Prüfe, ob es ein JSON-Feld ist
            if field_name in self.json_fields:
                # JSON-Feld Update
                existing_json = getattr(entity, field_name) or {}
                preserve_fields = json_field_preserve_fields.get(field_name, [])

                # Merge JSON-Updates
                if isinstance(value, dict):
                    import sys
                    print(f"[FIELD_HANDLER] Merging {field_name} - existing keys: {list(existing_json.keys())[:20]}", file=sys.stderr, flush=True)
                    print(f"[FIELD_HANDLER] Updates keys: {list(value.keys())[:20]}", file=sys.stderr, flush=True)
                    print(f"[FIELD_HANDLER] Preserve fields: {preserve_fields}", file=sys.stderr, flush=True)
                    
                    merged = self.merge_json_updates(
                        existing_json,
                        value,
                        preserve_fields=preserve_fields,
                    )
                    
                    print(f"[FIELD_HANDLER] After merge - keys: {list(merged.keys())[:20]}", file=sys.stderr, flush=True)
                    print(f"[FIELD_HANDLER] gender in merged: {'gender' in merged}, value: {merged.get('gender')}", file=sys.stderr, flush=True)
                    print(f"[FIELD_HANDLER] media_affinity in merged: {'media_affinity' in merged}, value: {merged.get('media_affinity')}", file=sys.stderr, flush=True)
                else:
                    merged = value

                # Weise NEUES Dict-Objekt zu (wichtig für SQLAlchemy)
                setattr(entity, field_name, deepcopy(merged))

                # Markiere als geändert (nur wenn SQLAlchemy-Entity)
                try:
                    flag_modified(entity, field_name)
                    import sys
                    print(f"[FIELD_HANDLER] Successfully flagged {field_name} as modified", file=sys.stderr, flush=True)
                except (AttributeError, TypeError) as e:
                    # Keine SQLAlchemy-Entity (z.B. in Tests) - das ist OK
                    import sys
                    print(f"[FIELD_HANDLER] Could not flag modified (expected in tests): {e}", file=sys.stderr, flush=True)
                    pass
            else:
                # Normale Spalten-Update
                setattr(entity, field_name, value)

