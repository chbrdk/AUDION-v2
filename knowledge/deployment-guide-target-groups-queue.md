# Deployment Guide: Target Groups & Queue Dashboard

## Überblick

Dieses Guide beschreibt, wie die neuen Target Groups und Queue Dashboard Features auf den Production-Server (192.168.50.101) deployed werden.

## Neue Features

### Frontend Routen
- `/target-groups/admin` - Target Group Admin Console
- `/queue` - Queue & Logs Dashboard

### Backend API Endpoints
- `/target-groups/*` - Target Group Management API
- `/queue/*` - Queue & Logs API

## Voraussetzungen

- SSH Zugriff auf den Production-Server (192.168.50.101)
- Docker & Docker Compose auf dem Server installiert
- Code Repository auf dem Server oder Möglichkeit zum Deployment

## Deployment Schritte

### Option 1: Deploy über Git (Empfohlen)

```bash
# 1. Auf dem Production-Server: Code aktualisieren
ssh user@192.168.50.101
cd /path/to/persona_chat
git pull origin main  # oder dein Branch

# 2. Ins infrastructure Verzeichnis wechseln
cd infrastructure

# 3. Web Container neu bauen (MIT Build)
WEB_RUN_BUILD=true docker compose build web

# 4. Container neu starten
docker compose up -d web

# 5. Logs prüfen
docker compose logs -f web
```

### Option 2: Direkter Build auf dem Server

```bash
# 1. SSH auf Server
ssh user@192.168.50.101
cd /path/to/persona_chat

# 2. TypeScript Types bauen
npm run build --workspace packages/types

# 3. Next.js App bauen
npm run build:web

# 4. Infrastructure Directory
cd infrastructure

# 5. Container neu bauen (mit neuem Build)
WEB_RUN_BUILD=true docker compose build web

# 6. Container neu starten
docker compose up -d web
```

### Option 3: Komplettes Rebuild aller Services

```bash
# 1. SSH auf Server
ssh user@192.168.50.101
cd /path/to/persona_chat/infrastructure

# 2. Alle Container neu bauen
docker compose build

# 3. Alle Container neu starten
docker compose up -d

# 4. Status prüfen
docker compose ps
```

## Verifikation

### 1. Frontend Routen prüfen

```bash
# Auf dem Server oder lokal testen:
curl -I https://192.168.50.101/target-groups/admin
curl -I https://192.168.50.101/queue
```

**Erwartete Antwort:** HTTP 200 (nicht 404)

### 2. Backend API Endpoints prüfen

```bash
# Target Groups API
curl https://192.168.50.101/api/persona-backend/target-groups

# Queue Stats API
curl https://192.168.50.101/api/persona-backend/queue/stats

# API Docs
curl https://192.168.50.101/api/persona-backend/docs
```

### 3. Browser Test

- Öffne: `https://192.168.50.101/target-groups/admin`
- Öffne: `https://192.168.50.101/queue`

**Erwartetes Ergebnis:** Seiten laden korrekt, keine 404 Fehler

## Wichtige Docker Compose Einstellungen

### WEB_RUN_BUILD Flag

In `infrastructure/compose.yml` ist der Default:
```yaml
RUN_WEB_BUILD: ${WEB_RUN_BUILD:-false}
```

**Für Production Builds:** Setze `WEB_RUN_BUILD=true`:

```bash
WEB_RUN_BUILD=true docker compose build web
```

### Build Context

Der Docker Build nutzt das Root-Verzeichnis als Context:
```yaml
build:
  context: ..
  dockerfile: apps/web/Dockerfile
```

Alle Dateien müssen im Repository vorhanden sein.

## Troubleshooting

### Problem: 404 Fehler auf neuen Routen

**Lösung:**
1. Prüfe, ob der Build die Routen erkennt:
   ```bash
   docker compose exec web npm run build:web
   # Sollte "/target-groups/admin" und "/queue" in der Ausgabe zeigen
   ```

2. Prüfe Container Logs:
   ```bash
   docker compose logs web | grep -E "(error|404|route)"
   ```

3. Prüfe, ob Dateien im Container vorhanden sind:
   ```bash
   docker compose exec web ls -la /app/apps/web/app/target-groups/admin/
   docker compose exec web ls -la /app/apps/web/app/queue/
   ```

### Problem: Backend API nicht erreichbar

**Lösung:**
1. Prüfe Persona API Container:
   ```bash
   docker compose ps persona-api
   docker compose logs persona-api
   ```

2. Prüfe, ob Queue Router registriert ist:
   ```bash
   curl https://192.168.50.101/api/persona-backend/docs
   # Sollte "/queue/*" Endpoints zeigen
   ```

3. Prüfe Nginx Reverse Proxy Konfiguration

### Problem: TypeScript Fehler im Build

**Lösung:**
1. Types Package bauen:
   ```bash
   npm run build --workspace packages/types
   ```

2. Prüfe TypeScript Errors:
   ```bash
   npm run typecheck --workspace apps/web
   ```

## Rollback (Falls nötig)

Falls etwas schief geht:

```bash
# 1. Container auf vorherige Version zurücksetzen
cd infrastructure
docker compose down web
docker compose pull web  # Falls Image im Registry
docker compose up -d web

# Oder: Git zurücksetzen
git checkout <previous-commit>
git pull
docker compose build web
docker compose up -d web
```

## Environment Variables

Stelle sicher, dass folgende Environment Variables gesetzt sind:

```env
# Frontend (Web Container)
NEXT_PUBLIC_PERSONA_BACKEND_URL=https://192.168.50.101/api/persona-backend
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://persona-api:8000

# Backend (Persona API Container)
API_PORT=8000
DATABASE_URL=postgresql+psycopg://persona:persona@postgres:5432/persona
REDIS_URL=redis://redis:6379/0
```

## Nginx Reverse Proxy

Falls Nginx als Reverse Proxy verwendet wird, stelle sicher, dass alle Routen weitergeleitet werden:

```nginx
location /target-groups/ {
    proxy_pass http://persona-web:3000;
}

location /queue {
    proxy_pass http://persona-web:3000;
}
```

## Nach Deployment Checkliste

- [ ] `/target-groups/admin` lädt korrekt
- [ ] `/queue` lädt korrekt
- [ ] `/api/persona-backend/target-groups` antwortet
- [ ] `/api/persona-backend/queue/stats` antwortet
- [ ] Keine Fehler in Browser Console
- [ ] Keine Fehler in Server Logs
- [ ] Navigation Links funktionieren

## Support

Bei Problemen:
1. Prüfe Docker Logs: `docker compose logs -f`
2. Prüfe Browser Console für Frontend Fehler
3. Prüfe Network Tab für API Fehler
4. Prüfe Server Logs für Backend Fehler


