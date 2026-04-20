# Coolify Deployment Guide - Persona Chat Projekt

## Übersicht

Dieses Dokument beschreibt alle Aspekte, die beim Deployment des Persona Chat Projekts auf Coolify beachtet werden müssen.

## Architektur-Übersicht

Das Projekt besteht aus:
- **3 Python FastAPI Services**: persona-api, chat-api, indexing-api
- **1 Next.js Frontend**: web
- **2 Celery Workers**: persona-worker, indexing-worker
- **5 Datenbanken/Services**: PostgreSQL, Redis, Qdrant, Neo4j, Tempo
- **1 Reverse Proxy**: Nginx (wird durch Coolify's Traefik ersetzt)

---

## Docker Compose Buildpack: "pull access denied"

Wenn Coolify den Stack mit **Docker Compose** (ein Build, dann `docker compose up -d`) deployt, kann es zu folgendem Fehler kommen:

```text
pull access denied for i4skcwkw48g4wk0ww04o8wk0_web, repository does not exist or may require 'docker login'
```

**Ursache:** Beim `up` versucht Compose, Images mit dem Coolify-Projektnamen zu **pullen** (z. B. von Docker Hub). Die Images wurden aber nur lokal gebaut und nie gepusht.

**Lösung im Repo:** In `docker-compose.yml` ist für alle Services mit `build:` gesetzt:

- **`image:`** – fester Name (z. B. `audion-web`, `audion-api`), damit das gebaute Image lokal unter diesem Namen getaggt wird.
- **`pull_policy: never`** – beim `up` werden diese Images **nicht** gezogen, es werden nur die zuvor gebauten lokalen Images verwendet.

Build-Reihenfolge in Coolify: zuerst **build** (Images werden als `audion-web`, `audion-api` usw. erzeugt), danach **up** (startet diese Images ohne Pull).

---

## Kritische Unterschiede zu Docker Compose

### 1. Kein Docker Compose Support

**Problem:** Coolify deployt keine Docker Compose Stacks direkt. Jeder Service muss als separate "Application" in Coolify konfiguriert werden.

**Lösung:**
- Jeder Service (web, persona-api, chat-api, indexing-api, persona-worker, indexing-worker) wird eine eigene Coolify-App
- Datenbanken können als Coolify's "Services" (PostgreSQL, Redis) oder als separate Apps deployt werden
- Qdrant, Neo4j und Tempo müssen als separate Docker-Apps konfiguriert werden

### 2. Service Discovery

**Problem:** Docker Compose verwendet Service-Namen (z.B. `postgres:5432`), Coolify nutzt interne URLs.

**Lösung:**
- Coolify generiert interne URLs für jeden Service
- Environment Variables müssen dynamisch auf Coolify's interne URLs verweisen
- Beispiel: Statt `postgres:5432` → `coolify-internal-{postgres-app-id}:5432`

### 3. Reverse Proxy (Traefik statt Nginx)

**Problem:** Aktuell wird Nginx als Reverse Proxy verwendet. Coolify nutzt Traefik.

**Lösung:**
- Traefik ist bereits in Coolify integriert
- Routing wird über Coolify's UI konfiguriert
- Nginx-Container wird nicht benötigt
- Path-basiertes Routing (`/api/chat`, `/api/persona-backend`) über Traefik Labels

### 4. Volumes und Persistent Storage

**Problem:** Docker Compose Volumes müssen zu Coolify Persistent Volumes migriert werden.

**Lösung:**
- Datenbank-Daten: Coolify's PostgreSQL/Redis Services haben automatische Persistence
- Qdrant, Neo4j: Separate Volume-Configs in Coolify
- File Uploads: Shared Volume oder S3-compatible Storage
- HuggingFace Cache: Shared Volume zwischen allen Python Services

---

## Deployment-Strategie

### Option A: Vollständige Migration (Empfohlen für Production)

Jeder Service wird als separate Coolify-App:

```
Coolify Server
├── Applications
│   ├── persona-web (Next.js Frontend)
│   ├── persona-api (FastAPI Backend)
│   ├── chat-api (FastAPI Chat Service)
│   ├── indexing-api (FastAPI Indexing Service)
│   ├── persona-worker (Celery Worker)
│   ├── indexing-worker (Celery Worker)
│   ├── qdrant (Vector Database)
│   ├── neo4j (Graph Database)
│   └── tempo (Observability)
├── Services
│   ├── postgres (PostgreSQL 17)
│   └── redis (Redis 7)
```

### Option B: Hybrid (Empfohlen für Migration)

Kritische Services auf Coolify, Datenbanken extern:

```
Coolify (Applications)
├── persona-web
├── persona-api
├── chat-api
├── indexing-api
├── persona-worker
└── indexing-worker

Extern (Docker Compose oder Managed)
├── postgres
├── redis
├── qdrant
├── neo4j
└── tempo
```

---

## Service-Konfiguration

### 1. PostgreSQL Service

**Coolify Service:**
- Type: PostgreSQL
- Version: 17
- Database Name: `persona`
- User: `persona`
- Password: (über Coolify Secrets)

**Connection String:**
```
DATABASE_URL=postgresql+psycopg://persona:{POSTGRES_PASSWORD}@coolify-postgres:5432/persona
```

**Migrations:**
- Initial Migration nach Deployment
- Alembic in persona-api Container ausführen

### 2. Redis Service

**Coolify Service:**
- Type: Redis
- Version: 7
- Password: (über Coolify Secrets)

**Connection String:**
```
REDIS_URL=redis://:${REDIS_PASSWORD}@coolify-redis:6379/0
```

### 3. Qdrant (Separate App)

**Docker Image:** `qdrant/qdrant:v1.11.3`

**Environment Variables:**
```bash
QDRANT__SERVICE__HTTP_PORT=6333
QDRANT__SERVICE__GRPC_PORT=6334
```

**Persistent Volume:**
- Path: `/qdrant/storage`
- Coolify Persistent Storage

**Public URL:** `http://qdrant.{domain}/` (über Traefik)

### 4. Neo4j (Separate App)

**Docker Image:** `neo4j:5.22.0`

**Environment Variables:**
```bash
NEO4J_AUTH=neo4j/{NEO4J_PASSWORD}
NEO4J_PLUGINS=["apoc"]
NEO4J_dbms_security_procedures_unrestricted=apoc.*
```

**Persistent Volume:**
- Path: `/data`
- Coolify Persistent Storage

**Ports:**
- HTTP: 7474
- Bolt: 7687

### 5. Tempo (Optional, Observability)

**Docker Image:** `grafana/tempo:2.6.0`

**Config File:** Via Volume Mount oder ConfigMap
**Port:** 4318 (OTLP)

---

## Application Konfigurationen

### 1. persona-web (Next.js Frontend)

**Build Configuration:**
- **Buildpack:** Dockerfile
- **Dockerfile:** `apps/web/Dockerfile`
- **Build Context:** Repository Root
- **Build Args:**
  - `NODE_IMAGE=node:22.11.0-alpine`
  - `RUN_WEB_BUILD=true`

**Design-System-Abhängigkeit:** Der Web-Build benötigt `@msqdx/react` aus dem externen Repo `msqdx-design-system`. Das Dockerfile klont es im `deps`-Stage nach `/msqdx-design-system` und kopiert es im `builder`-Stage explizit. Bei "Module not found: @msqdx/react" Build-Cache leeren und erneut bauen (siehe Troubleshooting 2a).

**Environment Variables:**
```bash
# Public URLs (Coolify generiert automatisch)
NEXT_PUBLIC_INDEXING_API_URL=https://indexing-api.{domain}/api/indexing
NEXT_PUBLIC_CHAT_API_URL=https://chat-api.{domain}/api/chat
NEXT_PUBLIC_WS_BASE_URL=wss://chat-api.{domain}/api/chat
NEXT_PUBLIC_PERSONA_BACKEND_URL=https://persona-api.{domain}/api/persona-backend
NEXT_PUBLIC_PERSONA_BACKEND_DOCS_URL=https://persona-api.{domain}/api/persona-backend/docs

# Internal URLs (für Server-Side Requests)
NEXT_BACKEND_INTERNAL_URL=http://coolify-internal-indexing-api:8000
NEXT_CHAT_API_INTERNAL_URL=http://coolify-internal-chat-api:8001
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://coolify-internal-persona-api:8000
```

**Port:** 3000
**Health Check:** `GET /`

**Traefik Labels (via Coolify UI):**
- Domain: `persona-chat.{domain}`
- Path: `/`

### 2. persona-api (FastAPI Backend)

**Build Configuration:**
- **Buildpack:** Dockerfile
- **Dockerfile:** `apps/api/Dockerfile`
- **Build Context:** Repository Root

**Environment Variables:**
```bash
APP_ENV=production
API_HOST=0.0.0.0
API_PORT=8000

# Database
DATABASE_URL=postgresql+psycopg://persona:${POSTGRES_PASSWORD}@coolify-postgres:5432/persona

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@coolify-redis:6379/0

# Data Storage
DATA_DIR=/app/data/uploads

# External Services
QDRANT_URL=http://coolify-internal-qdrant:6333
NEO4J_URI=bolt://coolify-internal-neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=${NEO4J_PASSWORD}

# Public URLs
PERSONA_BACKEND_PUBLIC_URL=https://persona-api.{domain}/api/persona-backend
PERSONA_BACKEND_DOCS_URL=https://persona-api.{domain}/api/persona-backend/docs
ROOT_PATH=/api/persona-backend

# AI APIs
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
CLAUDE_API_KEY=${ANTHROPIC_API_KEY}

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://coolify-internal-tempo:4318

# Cache
PERSONA_CACHE_TTL_SECONDS=300
```

**Port:** 8000
**Health Check:** `GET /health`

**Persistent Volumes:**
- `/app/data/uploads` → Shared Storage für Documents

**Traefik Labels:**
- Path: `/api/persona-backend`
- Strip Prefix: `/api/persona-backend`

### 3. chat-api (FastAPI Chat Service)

**Build Configuration:**
- **Buildpack:** Dockerfile
- **Dockerfile:** `apps/chat-api/Dockerfile`
- **Build Context:** Repository Root

**Environment Variables:**
```bash
APP_ENV=production
API_HOST=0.0.0.0
API_PORT=8001

DATABASE_URL=postgresql+psycopg://persona:${POSTGRES_PASSWORD}@coolify-postgres:5432/persona
QDRANT_URL=http://coolify-internal-qdrant:6333
NEO4J_URI=bolt://coolify-internal-neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=${NEO4J_PASSWORD}

ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
INDEXING_API_URL=http://coolify-internal-indexing-api:8000

OTEL_EXPORTER_OTLP_ENDPOINT=http://coolify-internal-tempo:4318
```

**Port:** 8001
**Health Check:** `GET /health`

**Traefik Labels:**
- Path: `/api/chat`
- WebSocket Support: Enabled
- Strip Prefix: `/api/chat`

### 4. indexing-api (FastAPI Indexing Service)

**Build Configuration:**
- **Buildpack:** Dockerfile
- **Dockerfile:** `apps/indexing-api/Dockerfile`
- **Build Context:** Repository Root

**Environment Variables:**
```bash
APP_ENV=production
API_HOST=0.0.0.0
API_PORT=8000

DATA_DIR=/app/data/uploads

DATABASE_URL=postgresql+psycopg://persona:${POSTGRES_PASSWORD}@coolify-postgres:5432/persona
REDIS_URL=redis://:${REDIS_PASSWORD}@coolify-redis:6379/0
QDRANT_URL=http://coolify-internal-qdrant:6333

OTEL_EXPORTER_OTLP_ENDPOINT=http://coolify-internal-tempo:4318
```

**Port:** 8000
**Health Check:** `GET /health`

**Persistent Volumes:**
- `/app/data/uploads` → Shared Storage
- `/root/.cache/huggingface` → Shared HuggingFace Cache

**Traefik Labels:**
- Path: `/api/indexing`
- Strip Prefix: `/api/indexing`

### 5. persona-worker (Celery Worker)

**Build Configuration:**
- **Dockerfile:** `apps/api/Dockerfile` (gleiche wie persona-api)
- **Command Override:**
  ```bash
  celery -A app.celery_app worker -Q celery,ingestion,journeys,analytics,moodboards,research -l info --pool=threads --concurrency=2
  ```

**Environment Variables:**
- Gleiche wie persona-api
- Kein Port (Worker läuft im Hintergrund)

**Persistent Volumes:**
- `/app/data/uploads` → Shared Storage
- `/root/.cache/huggingface` → Shared HuggingFace Cache

### 6. indexing-worker (Celery Worker)

**Build Configuration:**
- **Dockerfile:** `apps/indexing-api/Dockerfile` (gleiche wie indexing-api)
- **Command Override:**
  ```bash
  celery -A app.workers.process worker -Q indexing -l info --pool=threads --concurrency=2
  ```

**Environment Variables:**
- Gleiche wie indexing-api

**Persistent Volumes:**
- `/app/data/uploads` → Shared Storage
- `/root/.cache/huggingface` → Shared HuggingFace Cache

---

## Environment Variables Management

### Coolify Secrets

Alle sensiblen Werte über Coolify Secrets:

```bash
# Database
POSTGRES_PASSWORD=<secure-password>
REDIS_PASSWORD=<secure-password>
NEO4J_PASSWORD=<secure-password>

# AI APIs
ANTHROPIC_API_KEY=sk-ant-api03-...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
OPENAI_API_KEY=sk-...

# Optional
LOGFIRE_TOKEN=...
```

### Service-spezifische Variables

- Jede App hat eigene Environment Variables
- Shared Variables über Coolify's "Shared Environment Variables"
- Secrets werden automatisch injiziert

---

## Persistent Storage

### Shared Volumes

**Option 1: Coolify Persistent Volumes (Empfohlen)**
- Ein Volume pro App
- Mount Path konfigurierbar
- Backup über Coolify's Backup-Feature

**Option 2: NFS/Network Storage**
- Für Multi-Server Setups
- Shared zwischen allen Services

**Required Volumes:**

1. **Data Uploads** (`/app/data/uploads`)
   - Shared zwischen: persona-api, indexing-api, persona-worker, indexing-worker
   - Inhalt: Hochgeladene Dokumente, Persona Avatare

2. **HuggingFace Cache** (`/root/.cache/huggingface`)
   - Shared zwischen: persona-api, chat-api, indexing-api, workers
   - Größe: Kann mehrere GB werden (Modelle)

3. **Qdrant Storage** (`/qdrant/storage`)
   - Eigenes Volume für Qdrant
   - Inhalt: Vector Indizes

4. **Neo4j Data** (`/data`)
   - Eigenes Volume für Neo4j
   - Inhalt: Graph Database

5. **PostgreSQL Data**
   - Automatisch von Coolify verwaltet

6. **Redis Data**
   - Automatisch von Coolify verwaltet (optional persistent)

---

## Networking & Service Discovery

### Coolify's Internal Networking

Coolify generiert interne URLs für jeden Service:

```
coolify-internal-{app-id}
```

**Problem:** App-IDs sind nicht vorhersehbar.

**Lösung:**
1. **Service Discovery über Environment Variables:**
   - Coolify kann Services über spezielle Environment Variables referenzieren
   - Format: `http://{service-name}.coolify.internal`

2. **DNS-basierte Discovery:**
   - Jede App hat einen internen DNS-Namen
   - Beispiel: `persona-api.coolify.internal`

3. **Manuelle Konfiguration:**
   - Nach Deployment: Interne URLs aus Coolify UI kopieren
   - In Environment Variables einfügen

### Beispiel: Database Connection

```bash
# Statt: postgres:5432
# Verwende: {postgres-service-name}.coolify.internal:5432

# Oder via Coolify Service Reference
DATABASE_URL=postgresql+psycopg://persona:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/persona
```

---

## Reverse Proxy & Routing

### Traefik Configuration

Coolify nutzt Traefik automatisch. Routing über Coolify UI oder Labels:

**Path-based Routing:**

1. **Frontend:**
   - Domain: `persona-chat.{domain}`
   - Path: `/`
   - Target: persona-web:3000

2. **Persona Backend API:**
   - Domain: `persona-chat.{domain}`
   - Path: `/api/persona-backend`
   - Target: persona-api:8000
   - Strip Prefix: `/api/persona-backend`

3. **Chat API:**
   - Domain: `persona-chat.{domain}`
   - Path: `/api/chat`
   - Target: chat-api:8001
   - Strip Prefix: `/api/chat`
   - WebSocket: Enabled

4. **Indexing API:**
   - Domain: `persona-chat.{domain}`
   - Path: `/api/indexing`
   - Target: indexing-api:8000
   - Strip Prefix: `/api/indexing`

**Alternative: Separate Domains**

- `persona-chat.{domain}` → Frontend
- `api.{domain}` → Alle APIs (mit Path Routing)

### SSL/TLS

- Coolify verwaltet automatisch Let's Encrypt Zertifikate
- Automatische Erneuerung
- HTTPS für alle Domains

---

## Build Optimierungen

### Docker Build Cache

**Problem:** Builds können 20+ Minuten dauern.

**Lösung:**

1. **Multi-stage Builds optimieren:**
   - Dependencies Layer Caching
   - Build Args für Conditional Builds

2. **Coolify Build Cache:**
   - Coolify unterstützt Build Cache
   - Cache-Volumes zwischen Builds

3. **Pre-built Images:**
   - Base Images in Container Registry pushen
   - Referenzieren statt neu bauen

### Build Script Anpassung

Aktuelles Script (`scripts/build.sh`) muss für Coolify angepasst werden:

```bash
# Coolify führt automatisch docker build aus
# Kein manueller Cache-Management nötig
# Build Args über Coolify UI setzen
```

---

## Migration Checklist

### Pre-Deployment

- [ ] Coolify Server installieren (2+ CPU, 4GB+ RAM empfohlen)
- [ ] Domain konfigurieren (DNS Records)
- [ ] Secrets in Coolify anlegen
- [ ] Git Repository für Coolify zugänglich machen
- [ ] Docker Images testen lokal

### Deployment Steps

1. **Datenbanken:**
   - [ ] PostgreSQL Service erstellen
   - [ ] Redis Service erstellen
   - [ ] Database Credentials notieren

2. **Qdrant & Neo4j:**
   - [ ] Qdrant App erstellen (Docker Image)
   - [ ] Neo4j App erstellen (Docker Image)
   - [ ] Persistent Volumes konfigurieren

3. **Backend Services:**
   - [ ] persona-api App erstellen
   - [ ] chat-api App erstellen
   - [ ] indexing-api App erstellen
   - [ ] Environment Variables setzen
   - [ ] Service Dependencies konfigurieren

4. **Workers:**
   - [ ] persona-worker App erstellen
   - [ ] indexing-worker App erstellen
   - [ ] Command Override setzen

5. **Frontend:**
   - [ ] persona-web App erstellen
   - [ ] Build Args konfigurieren
   - [ ] Environment Variables setzen

6. **Routing:**
   - [ ] Traefik Routes konfigurieren
   - [ ] SSL Zertifikate generieren
   - [ ] Health Checks testen

### Post-Deployment

- [ ] Database Migrations ausführen
- [ ] Health Checks überprüfen
- [ ] Service Dependencies validieren
- [ ] File Uploads testen
- [ ] WebSocket Verbindungen testen
- [ ] Worker Jobs testen
- [ ] Monitoring einrichten

---

## Testing Strategy

### Staging Environment

**Empfehlung:** Zuerst Staging auf Coolify deployen

- Separate Coolify Instanz oder
- Separate Domains auf gleichem Server
- Test mit Production-Datenbank-Copy

### Smoke Tests

```bash
# Frontend
curl https://persona-chat.{domain}/

# APIs
curl https://persona-chat.{domain}/api/persona-backend/health
curl https://persona-chat.{domain}/api/chat/health

# WebSocket
wscat -c wss://persona-chat.{domain}/api/chat/ws/{conversation-id}

# Database Connections
# Via persona-api Container
```

### Load Testing

- Chat API WebSocket Verbindungen
- Document Upload Performance
- Worker Queue Processing

---

## Monitoring & Observability

### Coolify Built-in

- Application Logs
- Resource Usage (CPU, Memory)
- Health Check Status

### Tempo Integration

- OpenTelemetry Traces
- Endpoint: `http://tempo.coolify.internal:4318`

### Custom Monitoring

- Health Check Endpoints
- Service Status Dashboard
- Queue Monitoring

---

## Backup Strategy

### Coolify Backups

**Datenbanken:**
- PostgreSQL: Coolify's Backup Feature
- Redis: Optional (meist Cache)

**Persistent Volumes:**
- Coolify's Volume Backup
- Oder externe Backup-Lösung

**Manual Backups:**

```bash
# PostgreSQL
docker exec {postgres-container} pg_dump -U persona persona > backup.sql

# Volumes
# Via Coolify UI oder direkt auf Server
```

### Backup Schedule

- **Täglich:** PostgreSQL Database
- **Wöchentlich:** Qdrant & Neo4j Volumes
- **Bei Changes:** Vor Migrations

---

## Troubleshooting

### Häufige Probleme

**1. Service Discovery Issues**

**Problem:** Services können sich nicht erreichen.

**Lösung:**
- Interne URLs prüfen
- DNS-Namen verwenden statt IPs
- Coolify's Service Discovery Features nutzen

**2. Build Failures**

**Problem:** Docker Builds schlagen fehl.

**Lösung:**
- Build Logs in Coolify prüfen
- Build Context korrekt setzen
- Build Args prüfen

**2a. Web Build: "Module not found: Can't resolve '@msqdx/react'"**

**Ursache:** Die Web-App nutzt `@msqdx/react` über `file:../../../msqdx-design-system/packages/react`. Im Docker-Build wird das Repo per `git clone` nach `/msqdx-design-system` geholt; fehlt es dort oder wird der Builder-Stage nicht zuverlässig übernommen, schlägt der Next-Build fehl.

**Lösung:**
- Im Dockerfile wird in der Builder-Stage explizit `COPY --from=deps /msqdx-design-system` und `COPY --from=deps /app/node_modules` ausgeführt; Build ohne Cache testen.
- In Coolify: **Build-Cache leeren** und neu deployen (z. B. "Clear build cache" / "Rebuild without cache"), falls eine alte Layer-Cache-Schicht ohne Design-System verwendet wird.
- Sicherstellen, dass der `deps`-Stage das Clone-Step ausführt (Git im Image, Netzwerk-Zugriff auf `github.com/chbrdk/msqdx-design-system`).
- Siehe auch: `apps/web/Dockerfile` (Clone, explizite COPY im Builder, Vorprüfung mit `require.resolve('@msqdx/react')`).

**3. Volume Mount Issues**

**Problem:** Dateien werden nicht persistiert.

**Lösung:**
- Volume Paths prüfen
- Permissions überprüfen
- Shared Volumes richtig konfigurieren

**4. Routing Issues**

**Problem:** APIs sind nicht erreichbar.

**Lösung:**
- Traefik Routes prüfen
- Path Stripping konfigurieren
- Health Checks validieren

---

## Performance Considerations

### Resource Limits

**Empfohlene Limits pro Service:**

- **persona-api:** 4GB RAM, 2 CPU
- **chat-api:** 2GB RAM, 1 CPU
- **indexing-api:** 2GB RAM, 1 CPU
- **Workers:** 4GB RAM, 2 CPU (each)
- **Frontend:** 1GB RAM, 0.5 CPU

**Datenbanken:**
- **PostgreSQL:** 4GB+ RAM, 2 CPU
- **Redis:** 1GB RAM
- **Qdrant:** 2GB+ RAM, 1 CPU
- **Neo4j:** 4GB+ RAM, 2 CPU

### Scaling

**Horizontal Scaling:**
- Coolify unterstützt Replicas
- Load Balancing über Traefik
- Worker Scaling für Queue Processing

**Vertical Scaling:**
- Resource Limits erhöhen
- Database Performance Tuning

---

## Security Considerations

### Secrets Management

- Alle Secrets über Coolify Secrets
- Keine Secrets in Git
- Rotation Strategy

### Network Security

- Interne Services nicht öffentlich
- Traefik als einziger Entry Point
- Rate Limiting über Traefik

### Database Security

- Strong Passwords
- Connection Encryption
- Regular Updates

---

## Kostenoptimierung

### Server Ressourcen

- Start mit Minimum (4GB RAM, 2 CPU)
- Monitoring nutzen
- Hochskalieren bei Bedarf

### Storage

- HuggingFace Cache: Shared Volume
- Alte Dokumente archivieren
- Database Cleanup regelmäßig

### Build Optimization

- Cache nutzen
- Pre-built Images
- Conditional Builds

---

## Wichtige Notizen

### Service Dependencies

Services müssen in richtiger Reihenfolge gestartet werden:

1. Datenbanken (PostgreSQL, Redis)
2. Qdrant, Neo4j
3. Backend APIs
4. Workers
5. Frontend

### Database Migrations

Migrations müssen nach dem ersten Deployment manuell ausgeführt werden:

```bash
# Via persona-api Container
docker exec {persona-api-container} \
  uv run alembic upgrade head
```

Oder über Coolify's Execute Command Feature.

### First-Time Setup

Nach dem ersten Deployment:

1. Database Migrations ausführen
2. Initial Admin User erstellen (falls nötig)
3. Test Document Upload
4. Health Checks validieren

---

## Referenzen

- [Coolify Documentation](https://coolify.io/docs)
- [Docker Compose Migration Guide](https://coolify.io/docs/docker-compose)
- [Traefik Configuration](https://doc.traefik.io/traefik/)

---

**Letzte Aktualisierung:** 2025-11-29
**Version:** 1.0.0

