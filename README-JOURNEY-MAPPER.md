# Journey Mapper Feature - Deployment

## Status

✅ **Alle Code-Änderungen sind implementiert:**
- Backend: Models, Schemas, Router, Services, Tasks, Migration
- Frontend: Pages, Components, API Client
- Tests und Dokumentation

## Deployment

### Voraussetzungen

1. Docker/OrbStack muss laufen
2. Alle Services müssen erreichbar sein

### Deployment-Schritte

**Option 1: Automatisches Script**
```bash
./deploy-journey-mapper.sh
```

**Option 2: Manuell**

1. **Backend Image neu bauen:**
   ```bash
   cd infrastructure
   docker compose build persona-api
   ```

2. **Service starten:**
   ```bash
   docker compose up -d persona-api
   ```

3. **Migration ausführen:**
   ```bash
   docker compose exec persona-api python -m alembic upgrade head
   ```

4. **Frontend Build (optional, für Production):**
   ```bash
   cd apps/web
   npm run build
   ```

5. **Web Service neu starten (falls Frontend gebaut):**
   ```bash
   cd infrastructure
   docker compose restart web
   ```

### Verifikation

1. **Migration Status prüfen:**
   ```bash
   docker compose exec persona-api python -m alembic current
   ```
   Sollte zeigen: `20251126_1749_journey_mapper (head)`

2. **API Endpoints testen:**
   - API Docs: http://localhost/api/persona-backend/docs
   - Journey Endpoints: http://localhost/api/persona-backend/journeys

3. **Frontend prüfen:**
   - Journey List: http://localhost/admin/journeys

### Bekannte Issues

- ✅ **Behoben:** `metadata` Attribut-Konflikt → zu `element_metadata` geändert
- Die Datenbank-Spalte bleibt `metadata`, nur das Python-Attribut ist `element_metadata`

### Troubleshooting

**Docker nicht erreichbar:**
- OrbStack neu starten: `open -a OrbStack`
- Oder Docker Desktop starten

**Migration-Fehler:**
- Prüfe Logs: `docker compose logs persona-api`
- Prüfe Datenbank-Verbindung

**Service startet nicht:**
- Prüfe Logs: `docker compose logs persona-api --tail=50`
- Prüfe ob alle Dependencies vorhanden sind
