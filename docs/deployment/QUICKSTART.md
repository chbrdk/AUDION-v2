# Coolify Quick Start Guide

Schnelle Anleitung zum Deployment von AUDION auf Coolify.

## Schritt 1: Database Resources erstellen

### PostgreSQL erstellen

1. In Coolify: **Resources** → **Databases** → **PostgreSQL**
2. **Create Resource** klicken
3. Konfiguration:
   - **Name**: `audion-postgres`
   - **Version**: 16+ (empfohlen)
   - **Database Name**: `audion`
   - **Username**: `audion`
   - **Password**: Starkes Passwort generieren und **speichern!**
4. **Create** klicken

### Redis erstellen

1. In Coolify: **Resources** → **Databases** → **Redis**
2. **Create Resource** klicken
3. Konfiguration:
   - **Name**: `audion-redis`
   - **Version**: 7.4+ (empfohlen)
4. **Create** klicken

## Schritt 2: Application erstellen

1. In Coolify: **Applications** → **New Application**
2. **Docker Compose** auswählen
3. Konfiguration:
   - **Name**: `audion`
   - **Repository**: Wähle **Private Repository (with GitHub App)**
     - Klicke auf **Select Repository**
     - Suche nach `AUDION-v2` oder `chbrdk/AUDION-v2`
     - Wähle das Repository aus
   - **Branch**: `main`
   - **Build Pack**: Docker Compose (automatisch erkannt)
4. **Create** klicken

**Hinweis**: Falls du noch keine GitHub App in Coolify eingerichtet hast, siehe [GitHub App Setup](COOLIFY_GITHUB_SETUP.md).

## Schritt 3: Environment Variables setzen

In der Application: **Settings** → **Environment Variables**

### Database URLs (von Database Resources)

```bash
# PostgreSQL (Resource-Name als Host verwenden!)
DATABASE_URL=postgresql://audion:DEIN_PASSWORT@audion-postgres:5432/audion

# Redis
REDIS_URL=redis://audion-redis:6379/0
```

**Wichtig**: Ersetze `DEIN_PASSWORT` mit dem Passwort, das du bei der PostgreSQL-Resource erstellt hast!

### Neo4j Konfiguration

```bash
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=dein-neo4j-passwort  # Wähle ein sicheres Passwort
```

### AI API Keys

```bash
OPENAI_API_KEY=sk-proj-...  # Dein OpenAI API Key
CLAUDE_API_KEY=sk-ant-...   # Optional, für Claude Support
```

### Application Settings

```bash
APP_ENV=production
NODE_ENV=production

# Frontend Base Path (leer lassen für Root-Domain, oder /audion für Sub-Path)
NEXT_PUBLIC_BASE_PATH=

# Internal Service URLs (Docker Compose Service-Namen)
NEXT_PUBLIC_PERSONA_BACKEND_URL=http://api:8000
NEXT_PUBLIC_CHAT_API_URL=http://chat-api:8001
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://api:8000

# Indexing API
INDEXING_API_URL=http://indexing-api:8000

# Vector & Graph Databases
QDRANT_URL=http://qdrant:6333
```

## Schritt 4: Domain konfigurieren (optional)

1. In der Application: **Domains**
2. Domain hinzufügen (oder Coolify-Domain verwenden)
3. SSL wird automatisch von Coolify konfiguriert

**Hinweis**: Wenn du eine Sub-Path verwendest (z.B. `/audion`), setze:
```bash
NEXT_PUBLIC_BASE_PATH=/audion
```

## Schritt 5: Deploy

1. In der Application: **Deploy** klicken
2. Build-Logs beobachten
3. Warten bis alle Services gestartet sind

## Schritt 6: Database Migration

Nach dem ersten Deployment:

1. In Coolify: Application → **Services** → **api** → **Terminal** öffnen
2. Migration ausführen:
   ```bash
   alembic upgrade head
   ```

## Schritt 7: Verifizierung

### Health Checks prüfen

In Coolify: **Services** → Alle Services sollten **Healthy** sein:
- ✅ web
- ✅ api
- ✅ chat-api
- ✅ indexing-api
- ✅ celery-worker
- ✅ celery-beat
- ✅ qdrant
- ✅ neo4j

### Frontend testen

Öffne deine Domain (oder Coolify-Domain) im Browser:
- Frontend sollte laden
- API Health: `https://deine-domain.com/api/health`

## Troubleshooting

### Services starten nicht

1. **Logs prüfen**: Services → [service-name] → Logs
2. **Environment Variables prüfen**: Alle erforderlichen Variablen gesetzt?
3. **Database Resources prüfen**: Laufen sie und sind erreichbar?

### Database Connection Error

1. **DATABASE_URL prüfen**: 
   - Format: `postgresql://username:password@resource-name:5432/database`
   - Resource-Name muss exakt dem Database Resource Namen entsprechen
2. **Passwort prüfen**: Stimmt das Passwort?
3. **Network prüfen**: Sind Services im gleichen Netzwerk?

### Frontend zeigt 404

1. **NEXT_PUBLIC_BASE_PATH prüfen**: 
   - Leer für Root-Domain
   - `/audion` für Sub-Path
2. **Build-Logs prüfen**: Next.js Build erfolgreich?

## Nächste Schritte

- Siehe [vollständige Deployment-Dokumentation](coolify.md) für Details
- [Environment Variables Referenz](../environment-variables.md) für alle Variablen
