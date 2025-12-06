# Pydantic 2.12 Features - 05. Dezember 2025

## Status: ✅ Dokumentiert

## Aktuelle Version

- **Pydantic Settings:** 2.12.0 (bereits aktuell - keine neuere Version verfügbar)
- **Pydantic Core:** Wird indirekt über pydantic-settings verwendet

## Verfügbare Features in Pydantic 2.12.x

### 1. MISSING Sentinel
**Status:** Verfügbar in Pydantic 2.12.0+

**Beschreibung:**
- Unterscheidung zwischen `None` (explizit gesetzt) und fehlenden Werten
- Bessere Validation-Logik
- Klarere API für optionale Felder

**Anwendbarkeit:**
- Direkte Pydantic BaseModel Klassen könnten MISSING nutzen
- In unserem Projekt: Pydantic Models hauptsächlich in `udg-glass-proto` Package
- pydantic-settings nutzt Pydantic Core, aber MISSING ist für BaseModel relevant

**Beispiel:**
```python
from pydantic import BaseModel, Field, MISSING

class MyModel(BaseModel):
    optional_field: str | None = Field(default=MISSING)
    # None = explizit auf None gesetzt
    # MISSING = Feld wurde nicht gesetzt
```

### 2. PEP 728 Support
**Status:** Verfügbar in Pydantic 2.12.0+

**Beschreibung:**
- TypedDict mit typed extra items
- Präzisere Type Definitions
- Bessere Type Safety

**Anwendbarkeit:**
- Könnte für komplexe TypedDict-Definitionen genutzt werden
- Aktuell nicht direkt benötigt in unserem Code

## Integration Status

### Direkte Pydantic Models
- **Location:** `packages/proto` (udg-glass-proto)
- **Status:** Externes Package, separate Versionierung
- **Empfehlung:** MISSING Sentinel in zukünftigen Model-Definitionen nutzen

### Pydantic Settings
- **Version:** 2.12.0 (aktuell)
- **Status:** Funktioniert korrekt
- **Features:** Nutzt Pydantic Core Features indirekt

## Empfohlene Schritte

### Für neue Model-Definitionen
1. MISSING Sentinel nutzen für optionale Felder
2. PEP 728 für komplexe TypedDict-Definitionen
3. Bessere Type Hints

### Für bestehende Models
- Keine Änderungen nötig (rückwärtskompatibel)
- Graduelle Migration möglich

## Testing

### Validation Tests
- [ ] Model Validation funktioniert weiterhin
- [ ] Edge Cases (None, Missing Values) testen
- [ ] Type Safety prüfen

## Referenzen

- [Pydantic 2.12 Release Notes](https://pydantic.dev/articles/pydantic-v2-12-release)
- [Pydantic MISSING Sentinel](https://docs.pydantic.dev/latest/concepts/models/#missing-fields)
- [PEP 728](https://peps.python.org/pep-0728/)

---

**Erstellt:** 05. Dezember 2025  
**Status:** Dokumentiert, Features verfügbar für zukünftige Nutzung
