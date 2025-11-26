# Generisches Editieren & Speichern System

## Übersicht

Dieses System ermöglicht einheitliches Editieren und Speichern von Feldern für alle Entitäten (Persona, TargetGroup, Document, Knowledge, etc.). Es löst das Problem mit nicht gespeicherten Feldern (insbesondere None-Werte) und bietet eine zukunftssichere Architektur für neue Entitäten und Felder.

## Architektur

### Backend

#### 1. GenericFieldHandler (`apps/api/app/services/generic_field_handler.py`)

Zentrale Klasse für sicheres Mergen und Anwenden von Feld-Updates:

- `merge_json_updates()`: Merged JSON-Updates sicher zusammen, behandelt None-Werte korrekt
- `extract_fields_from_pydantic()`: Extrahiert Felder aus Pydantic-Modellen, inkl. None-Werte
- `apply_updates_to_entity()`: Wendet Updates auf SQLAlchemy-Entitäten an

**Wichtig**: Handhabt explizit None-Werte für preserved fields.

#### 2. Zentrale Feld-Konfiguration (`apps/api/app/services/field_config.py`)

Definiert:
- `ENTITY_EDITABLE_FIELDS`: Editierbare Felder pro Entität
- `ENTITY_PRESERVED_FIELDS`: Felder, die immer erhalten bleiben (auch bei None)

**Beispiel**:
```python
ENTITY_PRESERVED_FIELDS = {
    "persona": {
        "profile": ["gender", "age", "location", "media_affinity", "full_name"]
    }
}
```

### Frontend

#### 1. Feld-Definitionen (`packages/types/src/field-definitions.ts`)

TypeScript-Definitionen für Feld-Konfigurationen:
- `FieldDefinition` Type
- `ENTITY_FIELD_DEFINITIONS`: Feld-Definitionen pro Entität
- Helper-Funktionen: `getFieldDefinitions()`, `groupFields()`

#### 2. Generische Komponenten (`apps/web/components/generic/`)

- `UdgGlassFieldEditor`: Edit-Komponente für einzelne Felder
- `UdgGlassEntityEditor`: Editor für komplette Entitäten (gruppiert Felder)

## Verwendung

### Neue Felder hinzufügen

#### Backend

1. Feld zur Konfiguration hinzufügen (`apps/api/app/services/field_config.py`):

```python
ENTITY_PRESERVED_FIELDS = {
    "persona": {
        "profile": [
            "gender",
            "age",
            # ... existing fields ...
            "new_field",  # Neu hinzufügen
        ]
    }
}
```

2. Feld im Pydantic-Modell definieren (`packages/proto/src/udg_glass_proto/personas.py`):

```python
class PersonaProfile(BaseModel):
    # ... existing fields ...
    new_field: Optional[str] = None  # Neu hinzufügen
```

#### Frontend

1. Feld-Definition hinzufügen (`packages/types/src/field-definitions.ts`):

```typescript
export const ENTITY_FIELD_DEFINITIONS: Record<string, FieldDefinition[]> = {
  persona: [
    // ... existing fields ...
    {
      key: 'new_field',
      label: 'New Field',
      type: 'text',  // oder 'number', 'select', etc.
      group: 'demographics',  // oder andere Gruppe
      order: 6,
    },
  ],
};
```

2. Types Package neu bauen:

```bash
cd packages/types && npm run build
```

3. Fertig! Die Komponenten unterstützen das neue Feld automatisch.

### Neue Entität hinzufügen

#### Backend

1. Feld-Konfiguration hinzufügen (`apps/api/app/services/field_config.py`):

```python
ENTITY_EDITABLE_FIELDS = {
    # ... existing entities ...
    "new_entity": [
        "field1",
        "field2",
    ],
}

ENTITY_PRESERVED_FIELDS = {
    # ... existing entities ...
    "new_entity": {
        "json_field": ["preserved_field1", "preserved_field2"]
    }
}
```

2. Service nutzt GenericFieldHandler:

```python
from .generic_field_handler import GenericFieldHandler
from .field_config import get_preserved_fields

def update_new_entity(self, session, entity_id, payload):
    entity = session.get(NewEntity, entity_id)
    
    handler = GenericFieldHandler(
        entity_type="new_entity",
        json_fields=["json_field"],
    )
    
    preserve_fields = get_preserved_fields("new_entity", "json_field")
    # ... use handler.apply_updates_to_entity()
```

#### Frontend

1. Feld-Definitionen hinzufügen (`packages/types/src/field-definitions.ts`):

```typescript
export const ENTITY_FIELD_DEFINITIONS: Record<string, FieldDefinition[]> = {
  // ... existing entities ...
  newEntity: [
    {
      key: 'field1',
      label: 'Field 1',
      type: 'text',
      group: 'basic',
      order: 1,
    },
    // ... more fields ...
  ],
};
```

2. In Admin Panel verwenden:

```typescript
<UdgGlassEntityEditor
  entityType="newEntity"
  entity={entityData}
  onSave={async (updates) => {
    await updateNewEntity(entityId, updates);
  }}
  inline={true}
/>
```

## Technische Details

### None-Wert Behandlung

**Problem**: None-Werte gehen beim Speichern verloren.

**Lösung**:
1. Backend: Preserved fields werden immer explizit gesetzt (auch wenn None)
2. Backend: Direkter Attribut-Zugriff statt nur `model_dump()`
3. Backend: SQLAlchemy `flag_modified()` wird aufgerufen
4. Frontend: Felder werden explizit als `null` gesendet (nicht `undefined`)

### SQLAlchemy JSON-Column Updates

- Immer neues Dict-Objekt zuweisen (`copy.deepcopy()`)
- `flag_modified(entity, "json_field_name")` aufrufen
- Nach `commit()`: `session.refresh(entity)`

### Pydantic Model-Dump Verhalten

- `model_dump(exclude_none=False, exclude_unset=False)` verwenden
- Aber: Direkter Attribut-Zugriff ist zuverlässiger für None-Werte
- Preserved fields sollten direkt aus Attributen extrahiert werden

## Best Practices

1. **Immer preserved fields verwenden** für Felder, die None sein können
2. **Zentrale Konfiguration** - nie Felder hardcoden
3. **Type-Safety** - Types Package für Frontend und Backend synchron halten
4. **Testing** - Teste None-Werte explizit

## Migration bestehender Code

### Persona Admin Panel

Alte Komponente `UdgGlassBioCardEdit` wurde durch `UdgGlassEntityEditor` ersetzt:

```typescript
// Alt
<UdgGlassBioCardEdit
  profile={detail.profile}
  onSave={handleDemographicSave}
/>

// Neu
<UdgGlassEntityEditor
  entityType="persona"
  entity={detail.profile}
  onSave={async (updates) => {
    await handleDemographicSave(updates as Partial<PersonaProfile>);
  }}
  fieldOverrides={{
    name: undefined,  // Nur demografische Felder anzeigen
    headline: undefined,
    segment: undefined,
  }}
/>
```

### TargetGroup Admin Panel

Manuelle Edit-Logik wurde durch `UdgGlassEntityEditor` ersetzt:

```typescript
// Alt: Manuelle Edit-Logik für jedes Feld
const [editingField, setEditingField] = useState<'name' | 'segment' | 'description' | null>(null);
// ... komplexe handleStartEdit, handleSaveField, etc.

// Neu
<UdgGlassEntityEditor
  entityType="targetGroup"
  entity={detail}
  onSave={handleFieldSave}
  inline={true}
/>
```

## Fehlerbehebung

### Felder werden nicht gespeichert

1. Prüfe `ENTITY_PRESERVED_FIELDS` - ist das Feld als preserved definiert?
2. Prüfe Backend-Logs - wird `flag_modified()` aufgerufen?
3. Prüfe DB direkt - sind Felder in der JSON-Spalte vorhanden?

### None-Werte werden nicht gesendet

1. Frontend: Stelle sicher, dass `null` gesendet wird (nicht `undefined`)
2. Backend: Prüfe, ob preserved fields explizit gesetzt werden
3. Prüfe Pydantic-Modell - ist Feld als `Optional[...] = None` definiert?

### UI zeigt Felder nicht an

1. Prüfe `ENTITY_FIELD_DEFINITIONS` - ist Feld für Entität definiert?
2. Prüfe `fieldOverrides` - wird Feld vielleicht ausgefiltert?
3. Prüfe Types Package - wurde es neu gebaut?

## Zukünftige Erweiterungen

Das System ist darauf ausgelegt, einfach erweitert zu werden:

1. **Neue Feld-Typen**: In `UdgGlassFieldEditor` hinzufügen
2. **Neue Validierung**: In `FieldDefinition.config` erweitern
3. **Neue Entitäten**: Konfiguration in `field_config.py` und `field-definitions.ts` hinzufügen
4. **Neue Gruppierungen**: Feld-Definitionen mit `group` Attribut erweitern

