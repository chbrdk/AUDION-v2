# Optimization Deployment Plan - 05. Dezember 2025

## Übersicht

Deployment-Plan für die Projekt-Optimierungen vom 05. Dezember 2025.

## Pre-Deployment Checklist

### Code-Änderungen
- [x] Security-Updates durchgeführt
- [x] React Compiler aktiviert
- [x] Code-Optimierungen teilweise durchgeführt
- [ ] Alle Tests bestehen
- [ ] Performance-Baseline dokumentiert

### Dependencies
- [x] FastAPI 0.123.9 aktualisiert
- [x] Celery 5.6.0 aktualisiert
- [x] Python 3.12.12 Docker Image aktualisiert
- [ ] Lock Files aktualisiert (apps/api ✅, chat-api/indexing-api im Docker Build)

### Dokumentation
- [x] Changelog erstellt
- [x] Update-Dokumentationen erstellt
- [x] Optimierungsbericht erstellt

## Deployment-Phasen

### Phase 1: Staging Deployment

#### 1.1 Vorbereitung
```bash
# Git Tag erstellen
git tag -a optimization-2025-12-05 -m "Project optimization December 2025"

# Branch für Staging
git checkout -b deploy/optimization-2025-12-05-staging
```

#### 1.2 Build
```bash
# Docker Images bauen
cd infrastructure
docker compose build

# Oder mit Build-Script
LOCAL_DOCKER_CACHE_ROOT=/path/to/cache ./scripts/build.sh
```

#### 1.3 Staging Deployment
```bash
# Services auf Staging deployen
docker compose -f infrastructure/compose.yml up -d

# Health Checks
curl http://localhost:8000/health  # persona-api
curl http://localhost:8001/health  # chat-api
curl http://localhost:8000/health  # indexing-api
curl http://localhost:3000         # web
```

#### 1.4 Smoke Tests
- [ ] Alle Services starten erfolgreich
- [ ] Health Checks bestehen
- [ ] API-Endpoints erreichbar
- [ ] Frontend lädt korrekt
- [ ] Celery Workers starten
- [ ] Database-Verbindungen funktionieren

### Phase 2: Integration Tests

#### 2.1 API Tests
```bash
# Persona API Tests
pytest tests/api/test_personas.py

# Chat API Tests
pytest tests/api/test_chat.py

# Indexing API Tests
pytest tests/api/test_indexing.py
```

#### 2.2 E2E Tests
- [ ] User kann sich anmelden
- [ ] Persona-Liste lädt
- [ ] Chat funktioniert
- [ ] Document-Upload funktioniert
- [ ] Journey Mapper funktioniert
- [ ] Admin-Panel funktioniert

#### 2.3 Performance Tests
- [ ] API Response Times akzeptabel
- [ ] Database Query Performance verbessert
- [ ] Frontend Bundle Size reduziert
- [ ] Build Times akzeptabel

### Phase 3: Production Rollout

#### 3.1 Canary Deployment (Optional)
```bash
# Nur ein Service zuerst
# z.B. nur persona-api mit neuen Dependencies
```

#### 3.2 Rolling Deployment
```bash
# Services nacheinander deployen
# 1. persona-api
# 2. chat-api
# 3. indexing-api
# 4. web
```

#### 3.3 Monitoring
- [ ] Error Rates überwachen
- [ ] Response Times überwachen
- [ ] Resource Usage überwachen
- [ ] Logs prüfen

## Rollback-Strategie

### Bei Problemen

#### Sofortiger Rollback
```bash
# Git Tag zurücksetzen
git checkout optimization-2025-12-04  # Vorheriger Tag

# Docker Images mit alter Version bauen
docker compose -f infrastructure/compose.yml build

# Services neu starten
docker compose -f infrastructure/compose.yml up -d
```

#### Teilweiser Rollback
```bash
# Nur betroffenen Service zurücksetzen
# z.B. nur persona-api
```

### Rollback-Checklist
- [ ] Problem identifiziert
- [ ] Rollback-Entscheidung getroffen
- [ ] Git Tag zurücksetzen
- [ ] Docker Images neu bauen
- [ ] Services neu deployen
- [ ] Verifizieren, dass alles funktioniert
- [ ] Problem dokumentieren

## Monitoring & Alerting

### Metriken zu überwachen
- **API Response Times:** P50, P95, P99
- **Error Rates:** 4xx, 5xx Errors
- **Database Query Times:** Langsame Queries
- **Celery Task Processing:** Queue Length, Processing Time
- **Frontend Performance:** Bundle Size, Load Time
- **Resource Usage:** CPU, Memory, Disk

### Alerts
- Error Rate > 1%
- Response Time P95 > 2s
- Database Query > 5s
- Celery Queue Length > 100
- Memory Usage > 80%

## Post-Deployment

### 1. Verifizierung (24h)
- [ ] Alle Metriken im normalen Bereich
- [ ] Keine erhöhten Error Rates
- [ ] Performance-Verbesserungen messbar
- [ ] Keine User-Beschwerden

### 2. Dokumentation
- [ ] Deployment-Ergebnisse dokumentieren
- [ ] Performance-Verbesserungen messen
- [ ] Lessons Learned dokumentieren

### 3. Cleanup
- [ ] Alte Docker Images entfernen
- [ ] Temporäre Branches löschen
- [ ] Cache aufräumen

## Erfolgs-Kriterien

### Must-Have
- ✅ Alle Services laufen stabil
- ✅ Keine erhöhten Error Rates
- ✅ Performance-Verbesserungen messbar
- ✅ Keine Breaking Changes

### Nice-to-Have
- ✅ 20%+ schnellere Database Queries
- ✅ 60%+ schnellere Journey Validation
- ✅ 15%+ kleinere Frontend Bundle
- ✅ Bessere Developer Experience

## Kontakte

### Bei Problemen
- **Development Team:** [Kontakt]
- **DevOps Team:** [Kontakt]
- **On-Call:** [Kontakt]

## Referenzen

- **Changelog:** `CHANGELOG-2025-12-05.md`
- **Optimierungsbericht:** `knowledge/project-optimization-report-2025-12-05.md`
- **Update-Dokumentationen:** `knowledge/updates/`
- **Deployment-Guide:** `knowledge/coolify-deployment.md`

---

**Erstellt:** 05. Dezember 2025  
**Status:** Bereit für Staging Deployment  
**Nächste Review:** Nach Staging Deployment
