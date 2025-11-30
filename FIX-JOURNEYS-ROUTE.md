# Fix: Journeys Route nicht erreichbar

## Problem
Die Route `/admin/journeys` ist nicht erreichbar, weil:
1. Next.js die neuen Routes noch nicht erkannt hat
2. Der Web-Service muss neu gestartet werden
3. Möglicherweise gibt es Build-Fehler

## Lösung

### Schritt 1: Frontend Build (auf dem Server)

**Wenn du SSH-Zugriff auf 192.168.50.101 hast:**

```bash
# Auf dem Server
cd /path/to/AUDION/apps/web
npm run build
# Oder wenn im Docker Container:
docker compose exec web npm run build
```

**Oder lokal und dann deployen:**

```bash
cd apps/web
npm run build
# Dann die .next Ordner deployen
```

### Schritt 2: Web Service neu starten

```bash
cd infrastructure
docker compose restart web
# Oder
docker compose up -d --build web
```

### Schritt 3: Prüfen ob Route funktioniert

1. **Browser Console öffnen** (F12) und prüfen auf Fehler
2. **Network Tab** prüfen - gibt es 404 für `/admin/journeys`?
3. **Prüfen ob Next.js die Route erkennt:**
   - In Development Mode: Next.js sollte automatisch neue Routes erkennen
   - In Production Mode: Build muss neu gemacht werden

### Schritt 4: Backend Migration (falls noch nicht gemacht)

```bash
cd infrastructure
docker compose exec persona-api python -m alembic upgrade head
```

### Schritt 5: Verifikation

1. **API Endpoint testen:**
   ```bash
   curl http://192.168.50.101/api/persona-backend/journeys
   ```
   Sollte `[]` oder eine Liste von Journeys zurückgeben (nicht 404)

2. **Frontend Route testen:**
   - Direkt: http://192.168.50.101/admin/journeys
   - Über Navigation: Klick auf "Journeys" in der Sidebar

## Troubleshooting

### Route gibt 404
- **Next.js Development:** Route sollte automatisch funktionieren
- **Next.js Production:** `npm run build` muss ausgeführt werden
- Prüfe ob `apps/web/app/admin/journeys/page.tsx` existiert

### API gibt 404
- Prüfe ob Backend läuft: `docker compose ps persona-api`
- Prüfe ob Migration ausgeführt wurde
- Prüfe Backend Logs: `docker compose logs persona-api`

### Build-Fehler
- Prüfe TypeScript-Fehler: `cd apps/web && npm run type-check`
- Prüfe Linter: `npm run lint`
- Prüfe ob alle Imports korrekt sind

### Navigation zeigt Journeys nicht
- ✅ **Behoben:** Journeys wurde zur Navigation hinzugefügt
- Browser Cache leeren (Hard Refresh: Cmd+Shift+R)
- Web Service neu starten

## Quick Fix (Development Mode)

Wenn du im Development Mode bist, sollte Next.js die Route automatisch erkennen. Falls nicht:

```bash
# Web Service neu starten
cd infrastructure
docker compose restart web

# Oder komplett neu bauen
docker compose up -d --build web
```

## Quick Fix (Production Mode)

```bash
# 1. Build
cd apps/web
npm run build

# 2. Service neu starten
cd ../infrastructure
docker compose restart web
```

