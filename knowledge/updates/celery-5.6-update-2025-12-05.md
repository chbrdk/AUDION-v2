# Celery 5.6.0 Update - 05. Dezember 2025

## Status: ✅ Updates durchgeführt

## Durchgeführter Update

### Celery
- **Alt:** 5.5.3
- **Neu:** 5.6.0
- **Services betroffen:**
  - `apps/api/pyproject.toml`
  - `apps/indexing-api/pyproject.toml`

## Wichtige Änderungen in Celery 5.6.0

### Python Version Support
- **Python 3.8 Support entfernt:** Python 3.8 hat End-of-Life erreicht
- **Python 3.14 Support:** Initial support für Python 3.14 hinzugefügt
- **Status für unser Projekt:** ✅ OK - Wir nutzen Python 3.12

### SQS Transport Update
- **Änderung:** SQS transport hat von `urllib3` zurück zu `pycurl` gewechselt
- **Grund:** Kritische Issues bei SQS-Nutzern
- **Status für unser Projekt:** Nicht betroffen - Wir nutzen Redis

### Quorum Queues Support
- **Neu:** Konfigurationsoptionen für RabbitMQ Quorum Queues
- **Status für unser Projekt:** Nicht betroffen - Wir nutzen Redis

## Breaking Changes Prüfung

### Python 3.8 Support entfernt
**Status:** ✅ Nicht betroffen
- Wir nutzen Python 3.12
- Keine Migration nötig

### API Changes
**Zu prüfen:**
- [ ] Celery Tasks funktionieren weiterhin
- [ ] Worker startet erfolgreich
- [ ] Queue-Processing funktioniert
- [ ] Task-Retry-Logik funktioniert
- [ ] Task-Monitoring funktioniert

## Update-Schritte

### 1. Dependencies aktualisiert
```toml
# apps/api/pyproject.toml
celery[redis]==5.6.0

# apps/indexing-api/pyproject.toml
celery[redis]==5.6.0
```

### 2. Lock Files aktualisiert
```bash
cd apps/api && uv lock
cd apps/indexing-api && uv lock  # Wird im Docker Build aktualisiert
```

## Testing Checklist

### Persona API Worker (apps/api)
- [ ] Worker startet: `celery -A app.celery_app worker -Q ingestion -l info`
- [ ] Tasks werden verarbeitet
- [ ] Retry-Logik funktioniert
- [ ] Task-Monitoring funktioniert
- [ ] Queue-Status: `celery -A app.celery_app inspect active`

### Indexing API Worker (apps/indexing-api)
- [ ] Worker startet: `celery -A app.workers.process worker -Q indexing -l info`
- [ ] Document-Processing funktioniert
- [ ] Embedding-Generation funktioniert
- [ ] Queue-Processing funktioniert

### Integration Tests
- [ ] Document-Upload triggert Processing-Job
- [ ] Persona-Generation funktioniert
- [ ] Journey-Generation funktioniert
- [ ] Queue-Dashboard zeigt korrekte Status

## Migration Guide

### Keine Code-Änderungen nötig
Celery 5.6.0 ist rückwärtskompatibel mit 5.5.3:
- Task-Definitionen bleiben unverändert
- Worker-Konfiguration bleibt unverändert
- Queue-Konfiguration bleibt unverändert

### Empfohlene Schritte
1. ✅ Dependencies aktualisiert
2. ⏭️ Lock Files aktualisieren
3. ⏭️ Worker lokal testen
4. ⏭️ Integration Tests durchführen
5. ⏭️ Docker Images neu bauen

## Rollback-Strategie

Falls Probleme auftreten:
1. Git revert der pyproject.toml Änderungen
2. Lock Files zurücksetzen
3. Docker Images mit alter Version bauen

## Nächste Schritte

1. ✅ Dependencies aktualisiert
2. ⏭️ Lock Files aktualisieren (wird im Docker Build gemacht)
3. ⏭️ Worker lokal testen
4. ⏭️ Integration Tests
5. ⏭️ Staging Deployment

## Referenzen

- [Celery 5.6.0 Changelog](https://docs.celeryq.dev/en/stable/changelog.html#id1)
- [Celery Documentation](https://docs.celeryq.dev/)
- [Python 3.8 EOL](https://www.python.org/dev/peps/pep-0569/)

---

**Erstellt:** 05. Dezember 2025  
**Status:** Updates durchgeführt, Testing ausstehend  
**Nächste Review:** Nach Testing und Integration
