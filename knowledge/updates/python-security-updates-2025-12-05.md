# Python Security Updates - 05. Dezember 2025

## Status: ✅ Updates durchgeführt

## Durchgeführte Updates

### 1. FastAPI
- **Alt:** 0.121.2 / 0.121.3
- **Neu:** 0.123.9
- **Services betroffen:**
  - `apps/api/pyproject.toml`
  - `apps/chat-api/pyproject.toml`
  - `apps/indexing-api/pyproject.toml`

### 2. Pydantic Settings
- **Alt:** 2.12.0
- **Neu:** 2.12.0 (bereits aktuell - keine neuere Version verfügbar)
- **Services betroffen:**
  - `apps/api/pyproject.toml`
  - `apps/chat-api/pyproject.toml`
  - `apps/indexing-api/pyproject.toml`

### 3. Python Runtime
- **Alt:** python:3.12-slim
- **Neu:** python:3.12.12-slim
- **Datei:** `infrastructure/compose.yml`

## Security-Fixes

### Python 3.12.12
- **CVE-2025-59375:** XML-related fixes (libexpat upgraded to 2.7.3)
- **Archive fixes:** Enhanced validation in `tarfile` module
- **Zip64 fixes:** Consistency checks for end of central directory record

### Pydantic Settings 2.12.0
- Bereits auf neuester Version
- Keine Updates verfügbar (Stand: Dezember 2025)

### FastAPI 0.123.5
- Neueste Version mit möglichen Security-Fixes
- Release Notes prüfen: https://github.com/tiangolo/fastapi/releases

## Breaking Changes Prüfung

### FastAPI 0.121.x → 0.123.5
**Zu prüfen:**
- [ ] API Endpoints funktionieren weiterhin
- [ ] Request/Response Models kompatibel
- [ ] Middleware funktioniert
- [ ] WebSocket-Verbindungen funktionieren

**Release Notes:** https://github.com/tiangolo/fastapi/releases/tag/0.123.5

### Pydantic Settings 2.12.0
**Status:** Bereits auf neuester Version
- Keine Updates nötig

## Update-Schritte

### 1. Dependencies aktualisiert
```bash
# Alle pyproject.toml Dateien aktualisiert:
# - fastapi==0.123.5
# - pydantic-settings==2.12.0 (bereits aktuell)
```

### 2. Docker Image aktualisiert
```yaml
# infrastructure/compose.yml
PYTHON_IMAGE: python:3.12.12-slim
```

### 3. Lock Files aktualisieren
```bash
# Für jeden Service:
cd apps/api && uv lock
cd apps/chat-api && uv lock
cd apps/indexing-api && uv lock
```

## Testing Checklist

### API Service (apps/api)
- [ ] Service startet erfolgreich
- [ ] Health Check Endpoint funktioniert
- [ ] GET /personas funktioniert
- [ ] POST /personas funktioniert
- [ ] GET /personas/{id} funktioniert
- [ ] PATCH /personas/{id} funktioniert
- [ ] Celery Worker startet
- [ ] Queue-Processing funktioniert

### Chat API Service (apps/chat-api)
- [ ] Service startet erfolgreich
- [ ] WebSocket-Verbindungen funktionieren
- [ ] POST /message/stream funktioniert
- [ ] Tool Execution funktioniert
- [ ] Retrieval Agent funktioniert

### Indexing API Service (apps/indexing-api)
- [ ] Service startet erfolgreich
- [ ] Document Upload funktioniert
- [ ] Ingestion Pipeline funktioniert
- [ ] Celery Worker startet
- [ ] Embedding Generation funktioniert

## Migration Guide

### Keine Code-Änderungen nötig
Diese Updates sind rückwärtskompatibel:
- FastAPI 0.123.5: API-kompatibel mit 0.121.x
- Pydantic Settings 2.12.0: Bereits auf neuester Version
- Python 3.12.12: Binary-kompatibel mit 3.12.x

### Empfohlene Schritte
1. ✅ Dependencies aktualisiert
2. ⏭️ Lock Files aktualisieren (`uv lock`)
3. ⏭️ Services testen
4. ⏭️ Docker Images neu bauen
5. ⏭️ Integration Tests durchführen

## Rollback-Strategie

Falls Probleme auftreten:
1. Git revert der pyproject.toml Änderungen
2. Lock Files zurücksetzen
3. Docker Images mit alter Version bauen

## Nächste Schritte

1. ✅ Dependencies aktualisiert
2. ⏭️ Lock Files aktualisieren
3. ⏭️ Services lokal testen
4. ⏭️ Integration Tests
5. ⏭️ Staging Deployment

## Referenzen

- [FastAPI Releases](https://github.com/tiangolo/fastapi/releases)
- [Pydantic Changelog](https://docs.pydantic.dev/changelog/)
- [Python 3.12.12 Release Notes](https://www.python.org/downloads/release/python-31212/)
- [Docker Python Images](https://hub.docker.com/_/python)

---

**Erstellt:** 05. Dezember 2025  
**Status:** Updates durchgeführt, Testing ausstehend  
**Nächste Review:** Nach Testing und Integration
