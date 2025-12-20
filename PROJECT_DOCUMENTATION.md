# Dynamic Persona Chat - Vollständige Projektdokumentation

## Inhaltsverzeichnis

1. [Projekt-Überblick](#projekt-überblick)
2. [Architektur](#architektur)
3. [URLs und Pfade (Zentrale Referenz)](#urls-und-pfade-zentrale-referenz)
4. [Services und Komponenten](#services-und-komponenten)
5. [Setup und Installation](#setup-und-installation)
6. [API-Dokumentation](#api-dokumentation)
7. [Datenmodelle](#datenmodelle)
8. [Development-Workflow](#development-workflow)
9. [Deployment](#deployment)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)
12. [Wichtige Konzepte](#wichtige-konzepte)

---

## Projekt-Überblick

### Vision

**Dynamic Persona Chat** ist ein System, das während der Konversation automatisch Personas aus Research-Daten erstellt und sie sofort befragbar macht. User laden Dokumente hoch → AI erkennt Personas → User chattet direkt mit ihnen.

### Kernfunktionalität

- **Zero Setup Time**: Dokumente hochladen → sofort chatbereit
- **Dynamische Persona-Erstellung**: Personas werden on-demand während des Chats generiert
- **Adaptive Persona-Pool**: Startet mit 0 Personas, erstellt neue on-demand
- **Confidence-Driven Responses**: Jede Aussage hat einen Confidence-Score
- **Transparent AI**: Jede Aussage ist mit Source Chunks verlinkt

### Technologie-Stack

**Frontend:**
- Next.js 15
- Vercel AI SDK (Streaming)
- shadcn/ui / Material-UI
- TypeScript
- React 19

**Backend:**
- FastAPI (Python 3.12)
- Celery (Async Jobs)
- WebSocket (Real-time Chat)
- SQLAlchemy (ORM)
- Alembic (Migrations)

**Datenbanken:**
- PostgreSQL (Metadaten, Personas, Jobs)
- Qdrant (Vector Database für Embeddings)
- Neo4j (Graph Database für Beziehungen)
- Redis (Queue, Caching)

**AI/ML:**
- Claude API (Anthropic) - LLM für Persona-Generierung
- BGE-M3 (FlagEmbedding) - Embeddings (CPU)
- Whisper (faster-whisper) - Audio-Transkription (CPU)
- Unstructured - Dokumenten-Parsing

**Deployment:**
- Docker Compose
- Nginx (Reverse Proxy)
- CPU-only Server (keine GPU erforderlich)

---

## Architektur

### Service-Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (Reverse Proxy)                │
│                    Port 80/443 (HTTPS)                       │
└──────────────┬──────────────────────────────────────────────┘
               │
    ┌──────────┴──────────┬──────────────┬──────────────┐
    │                     │              │              │
┌───▼────┐        ┌───────▼────┐  ┌─────▼─────┐  ┌─────▼─────┐
│  Web   │        │  Chat API  │  │ Persona   │  │ Indexing  │
│ (3000) │        │   (8001)   │  │   API     │  │   API     │
│        │        │            │  │  (8000)   │  │  (8000)   │
└────────┘        └────────────┘  └───────────┘  └───────────┘
                           │              │              │
                    ┌──────┴──────────────┴──────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
   ┌────▼────┐            ┌─────▼─────┐
   │ Workers │            │ Databases │
   │ (Celery)│            │           │
   └─────────┘            └───────────┘
```

### Datenfluss: Document Upload → Chat

```
1. User uploads Document (PDF, DOCX, Audio, etc.)
   ↓
2. Document wird in Storage gespeichert
   ↓
3. ProcessingJob wird erstellt (status: "pending")
   ↓
4. Celery Worker startet Ingestion:
   - Text-Extraktion (Unstructured)
   - Audio-Transkription (Whisper, falls Audio)
   - Semantic Chunking (800-1200 tokens)
   - Embedding-Generierung (BGE-M3)
   - Speicherung in Qdrant (Vector DB)
   - Graph-Integration (Neo4j)
   ↓
5. Document Status: "completed"
   ↓
6. User startet Chat
   ↓
7. Retrieval Agent:
   - Embed Query
   - Vector Search (Qdrant)
   - Graph Search (Neo4j)
   ↓
8. Persona Agent:
   - Build System Prompt
   - Claude API Call (Streaming)
   - Response mit Sources
```

### Target Groups Architektur

```
Target Group (z.B. "Enterprise Buyers")
├── Knowledge Entries (gemeinsam für alle Personas)
│   ├── Pain Points
│   ├── Goals
│   └── Business Context
├── Sources (Chunks aus Research-Daten)
│   └── Document Chunks mit Embeddings
└── Personas
    ├── Erik (CFO, skeptisch)
    ├── Thomas (CTO, technikaffin)
    └── Claudia (CEO, business-fokussiert)
```

**Vorteile:**
- Mehrere Persona-Varianten pro Target Group
- Gemeinsames Knowledge für alle Personas einer Target Group
- Effizientere Knowledge-Wartung
- Zufällige Persona-Generierung basierend auf Target Group Knowledge

---

## URLs und Pfade (Zentrale Referenz)

### ⚠️ WICHTIG: Nie URLs/Pfade hardcodieren! Immer diese Referenz verwenden.

### Production URLs (via Nginx)

**Base URL:** `https://192.168.50.101`

**Hinweis:** Audion läuft unter dem Pfad `/audion`, um parallelen Betrieb mit anderen Services (z.B. `/dashboard`) zu ermöglichen.

| Service | Public URL | Internal URL | Beschreibung |
|---------|-----------|--------------|--------------|
| Web App | `https://192.168.50.101/audion/` | `http://web:3000` | Next.js Frontend |
| Chat API | `https://192.168.50.101/audion/api/chat` | `http://chat-api:8001` | Real-time Chat Service |
| Voice API | `https://192.168.50.101/audion/api/voice` | `http://chat-api:8001` | Voice Streaming |
| Persona Backend | `https://192.168.50.101/audion/api/persona-backend` | `http://persona-api:8000` | Persona Management API |
| Persona Docs | `https://192.168.50.101/audion/api/persona-backend/docs` | - | FastAPI Swagger UI |
| Indexing API | `https://192.168.50.101/audion/api/indexing` | `http://indexing-api:8000` | Document Ingestion |
| Neo4j Browser | `https://192.168.50.101/neo4j/browser` | `http://neo4j:7474` | Neo4j Web UI (global) |
| Qdrant Dashboard | `https://192.168.50.101/qdrant/` | `http://qdrant:6333` | Qdrant Web UI (global) |

### Development URLs (Local)

| Service | URL | Port |
|---------|-----|------|
| Web App | `http://localhost:3000` | 3000 |
| Persona API | `http://localhost:8000` | 8000 |
| Chat API | `http://localhost:8001` | 8001 |
| Indexing API | `http://localhost:8000` | 8000 |
| PostgreSQL | `localhost:55432` | 55432 |
| Redis | `localhost:6380` | 6380 |
| Qdrant | `http://localhost:6333` | 6333 |
| Neo4j | `http://localhost:7474` | 7474 |
| Neo4j Bolt | `bolt://localhost:7687` | 7687 |

### Environment Variables für URLs

**Frontend (Next.js):**
```bash
NEXT_PUBLIC_BASE_PATH=/audion
NEXT_PUBLIC_INDEXING_API_URL=https://192.168.50.101/audion/api/indexing
NEXT_PUBLIC_CHAT_API_URL=https://192.168.50.101/audion/api/chat
NEXT_PUBLIC_WS_BASE_URL=wss://192.168.50.101/audion/api/chat
NEXT_PUBLIC_PERSONA_BACKEND_URL=https://192.168.50.101/audion/api/persona-backend
NEXT_PUBLIC_PERSONA_BACKEND_DOCS_URL=https://192.168.50.101/audion/api/persona-backend/docs
NEXT_BACKEND_INTERNAL_URL=http://indexing-api:8000
NEXT_CHAT_API_INTERNAL_URL=http://chat-api:8001
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://persona-api:8000
```

**Backend (Python):**
```bash
DATABASE_URL=postgresql+psycopg://persona:persona@postgres:5432/persona
REDIS_URL=redis://redis:6379/0
QDRANT_URL=http://qdrant:6333
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_password
INDEXING_API_URL=http://indexing-api:8000
PERSONA_BACKEND_PUBLIC_URL=https://192.168.50.101/audion/api/persona-backend
PERSONA_BACKEND_DOCS_URL=https://192.168.50.101/audion/api/persona-backend/docs
ROOT_PATH=/api/persona-backend  # Für Reverse Proxy
```

### Datei-Pfade

**Storage-Pfade:**
- Document Storage: `data/uploads/documents/{document_id}/{filename}`
- Persona Documents: `data/uploads/personas/{persona_id}/documents/{document_id}/{filename}`
- Persona Avatars: `data/uploads/personas/{persona_id}/avatar.{ext}`

**Code-Referenzen:**
- Frontend URL Helper: `apps/web/app/api/_lib/backend.ts`
- Backend Config: `apps/api/app/core/config.py`
- Nginx Config: `infrastructure/nginx/nginx.conf`

---

## Services und Komponenten

### 1. Web (Next.js Frontend)

**Pfad:** `apps/web/`

**Technologien:**
- Next.js 15 (App Router)
- React 19
- TypeScript
- Material-UI / shadcn/ui
- Vercel AI SDK

**Hauptfunktionen:**
- Document Upload UI
- Chat Interface (WebSocket)
- Persona Admin Dashboard
- Target Groups Management
- Queue Dashboard

**Routen:**
- `/` - Hauptseite
- `/chat/[conversationId]` - Chat Interface
- `/admin` - Persona Admin Dashboard
- `/target-groups/admin` - Target Groups Management
- `/queue` - Queue & Logs Dashboard

**Commands:**
```bash
npm run dev:web        # Development Server
npm run build:web     # Production Build
npm run lint          # Linting
npm run typecheck     # Type Checking
```

### 2. Persona API (Backend Management)

**Pfad:** `apps/api/`

**Technologien:**
- FastAPI
- SQLAlchemy
- Celery
- Pydantic

**Hauptfunktionen:**
- Persona CRUD Operations
- Target Groups Management
- Document Management
- Knowledge Entries Management
- Queue Management
- Service Status Monitoring

**Commands:**
```bash
cd apps/api
uv sync                    # Dependencies installieren
uv run fastapi dev app/main.py --port 8000  # Development Server
uv run celery -A app.celery_app worker -Q ingestion -l INFO  # Worker
uv run pytest              # Tests
```

### 3. Chat API (Real-time Chat Service)

**Pfad:** `apps/chat-api/`

**Technologien:**
- FastAPI
- WebSocket
- Anthropic Claude API
- Vector Retrieval

**Hauptfunktionen:**
- Real-time Chat (WebSocket)
- Persona Discovery
- Persona Generation
- Voice Streaming
- Retrieval Agent Integration

**Commands:**
```bash
cd apps/chat-api
uv sync
uv run fastapi dev app/main.py --port 8001
```

### 4. Indexing API (Document Processing)

**Pfad:** `apps/indexing-api/`

**Technologien:**
- FastAPI
- Unstructured
- FlagEmbedding (BGE-M3)
- faster-whisper

**Hauptfunktionen:**
- Document Upload & Processing
- Text Extraction
- Audio Transkription
- Chunking & Embedding
- Qdrant Integration

**Commands:**
```bash
cd apps/indexing-api
uv sync
uv run fastapi dev app/main.py --port 8000
uv run celery -A app.workers.process worker -Q indexing -l info
```

### 5. Workers (Celery)

**Persona Worker:**
- Queue: `ingestion`
- Tasks: Document Ingestion, Persona Generation

**Indexing Worker:**
- Queue: `indexing`
- Tasks: Document Processing, Embedding Generation

---

## Setup und Installation

### Voraussetzungen

- Docker & Docker Compose
- Node.js 22+ (für lokale Web-Entwicklung)
- Python 3.12+ (für lokale Backend-Entwicklung)
- uv (Python Package Manager)

### Environment-Variablen

**Root `.env` Datei erstellen:**

```bash
# AI APIs
ANTHROPIC_API_KEY=sk-ant-api03-...
CLAUDE_API_KEY=${ANTHROPIC_API_KEY}  # Alias
OPENAI_API_KEY=sk-...  # Für Persona Image Generation

# Voice (Optional)
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MODEL_ID=eleven_monolingual_v1
ELEVENLABS_BASE_URL=https://api.elevenlabs.io

# Observability (Optional)
LOGFIRE_TOKEN=...
```

**Siehe auch:** `knowledge/env.md`

### Lokale Entwicklung

**1. Dependencies installieren:**
```bash
# Frontend
npm install

# Backend
cd apps/api && uv sync --python 3.12
cd apps/api && uv pip install -e ../../packages/proto
```

**2. Services starten (Docker Compose):**
```bash
cd infrastructure
docker compose up -d postgres redis qdrant neo4j tempo
```

**3. Datenbank-Migrationen:**
```bash
cd apps/api
uv run alembic upgrade head
```

**4. Services starten:**
```bash
# Terminal 1: Web
npm run dev:web

# Terminal 2: Persona API
cd apps/api && uv run fastapi dev app/main.py --port 8000

# Terminal 3: Chat API
cd apps/chat-api && uv run fastapi dev app/main.py --port 8001

# Terminal 4: Worker
cd apps/api && uv run celery -A app.celery_app worker -Q ingestion -l INFO
```

### Docker Compose (Vollständig)

**Alle Services starten:**
```bash
cd infrastructure
docker compose up -d
```

**Services neu bauen:**
```bash
cd infrastructure
docker compose build
```

**Logs anzeigen:**
```bash
docker compose logs -f [service-name]
```

**Services stoppen:**
```bash
docker compose down
```

### Build-Optimierung

**Build Cache konfigurieren:**
```bash
export LOCAL_DOCKER_CACHE_ROOT=/path/to/cache
mkdir -p $LOCAL_DOCKER_CACHE_ROOT/web $LOCAL_DOCKER_CACHE_ROOT/python
```

**Build Script verwenden:**
```bash
LOCAL_DOCKER_CACHE_ROOT=/path/to/cache ./scripts/build.sh
```

**Siehe auch:** `knowledge/build-cache.md`

---

## API-Dokumentation

### Persona Backend API (`/api/persona-backend`)

#### Journeys

**GET `/journeys`**
- Liste aller Journeys mit Pagination
- Query Params: `target_group_id`, `project_id`, `page`, `page_size`
- Response: `List[JourneyResponse]`

**POST `/journeys`**
- Erstelle neue Journey
- Body: `JourneyCreate`
- Response: `JourneyResponse`

**GET `/journeys/{journey_id}`**
- Journey-Details abrufen
- Response: `JourneyResponse`

**PUT `/journeys/{journey_id}`**
- Journey aktualisieren
- Body: `JourneyCreate`
- Response: `JourneyResponse`

**DELETE `/journeys/{journey_id}`**
- Journey löschen

**POST `/journeys/{journey_id}/phases`**
- Phase zu Journey hinzufügen
- Body: `PhaseCreate`
- Response: `PhaseResponse`

**POST `/journeys/{journey_id}/validate`**
- Journey gegen Personas validieren
- Body: `ValidationRequest`
- Response: `JourneyValidationReport`

**POST `/journeys/{journey_id}/tracking/sync`**
- Measurements von Analytics synchronisieren
- Response: Status

**GET `/journeys/{journey_id}/insights`**
- Liste aller Insights für Journey
- Response: `List[InsightResponse]`

Siehe: `knowledge/journey_mapper.md` für vollständige API-Dokumentation.

#### Personas

**GET `/personas`**
- Liste aller Personas mit Pagination
- Query Params: `project_id`, `target_group_id`, `status`, `q` (search), `page`, `page_size`
- Response: `PersonaListResponse`

**POST `/personas`**
- Erstelle neue Persona manuell
- Body: `PersonaCreateRequest`
- Response: `PersonaResponse`

**POST `/personas/generate`**
- Generiere Persona automatisch aus Research-Daten
- Body: `PersonaGenerateRequest` (mit `target_group_id` oder `segment`)
- Response: `PersonaResponse`

**GET `/personas/{persona_id}`**
- Persona-Details abrufen
- Response: `PersonaResponse`

**PATCH `/personas/{persona_id}`**
- Persona aktualisieren
- Body: `PersonaPatchRequest`
- Response: `PersonaResponse`

**DELETE `/personas/{persona_id}`**
- Persona löschen (soft delete)

**POST `/personas/{persona_id}/documents`**
- Dokument zu Persona hochladen
- Multipart Form: `file`, `uploaded_by`
- Response: `PersonaDocument`

**GET `/personas/{persona_id}/documents`**
- Liste aller Dokumente einer Persona
- Response: `List[PersonaDocument]`

**POST `/personas/{persona_id}/documents/{document_id}/retry`**
- Ingestion für fehlgeschlagenes Dokument wiederholen
- Response: `PersonaDocument`

**DELETE `/personas/{persona_id}/documents/{document_id}`**
- Dokument und alle zugehörigen Daten löschen

**POST `/personas/{persona_id}/knowledge`**
- Knowledge Entry zu Persona hinzufügen
- Body: `PersonaKnowledgeUpsertRequest`
- Response: `PersonaKnowledgeEntry`

**GET `/personas/{persona_id}/knowledge`**
- Liste aller Knowledge Entries
- Response: `List[PersonaKnowledgeEntry]`

**POST `/personas/{persona_id}/avatar`**
- Avatar für Persona hochladen
- Multipart Form: `file`
- Response: `PersonaResponse`

**GET `/personas/{persona_id}/avatar`**
- Avatar abrufen
- Response: Image Stream

**POST `/personas/{persona_id}/generate-image`**
- Avatar mit DALL-E generieren
- Response: `PersonaResponse`

#### Target Groups

**GET `/target-groups`**
- Liste aller Target Groups
- Query Params: `project_id`, `page`, `page_size`
- Response: `TargetGroupListResponse`

**POST `/target-groups`**
- Erstelle neue Target Group
- Body: `TargetGroupCreateRequest`
- Response: `TargetGroupResponse`

**GET `/target-groups/{target_group_id}`**
- Target Group Details
- Response: `TargetGroupResponse` (inkl. Personas & Knowledge)

**PATCH `/target-groups/{target_group_id}`**
- Target Group aktualisieren
- Body: `TargetGroupUpdateRequest`
- Response: `TargetGroupResponse`

**GET `/target-groups/{target_group_id}/knowledge`**
- Knowledge Entries einer Target Group
- Response: `List[PersonaKnowledgeEntry]`

**POST `/target-groups/{target_group_id}/knowledge`**
- Knowledge Entry hinzufügen
- Body: `TargetGroupKnowledgeUpsertRequest`
- Response: `PersonaKnowledgeEntry`

**GET `/target-groups/{target_group_id}/knowledge/chunks`**
- Knowledge Chunks für Visualisierung
- Response: `List[KnowledgeChunk]`

**GET `/target-groups/{target_group_id}/knowledge/clusters`**
- Clustered Knowledge für Analytics
- Response: `ClusterResult`

**POST `/target-groups/{target_group_id}/generate-persona`**
- Generiere Persona für Target Group
- Body: `TargetGroupPersonaGenerateRequest`
- Response: `PersonaResponse`

#### Documents

**POST `/documents/upload`**
- Dokument hochladen
- Multipart Form: `file`
- Response: `DocumentUploadResponse` (mit `job_id`)

**GET `/documents/{document_id}/status`**
- Status eines Processing Jobs
- Response: `UploadJobStatus`

#### Queue

**GET `/queue/jobs`**
- Liste aller Processing Jobs
- Query Params: `status`, `document_id`, `page`, `page_size`, `date_from`, `date_to`
- Response: `ProcessingJobListResponse`

**GET `/queue/jobs/{job_id}`**
- Job-Details
- Response: `ProcessingJobDetailResponse`

**GET `/queue/stats`**
- Queue-Statistiken
- Response: `QueueStatsResponse`

**GET `/queue/logs`**
- Logs für Jobs
- Query Params: `job_id`, `level`, `limit`
- Response: `LogListResponse`

**GET `/queue/services/status`**
- Status aller Services
- Response: `ServiceStatusResponse`

### Chat API (`/api/chat`)

**WebSocket `/chat/{conversation_id}`**
- Real-time Chat Endpoint
- Messages: `{type: "message", content: "..."}`
- Responses: `{type: "content_delta", data: "..."}`, `{type: "sources", sources: [...]}`, `{type: "complete"}`

**POST `/v1/personas/{id}`**
- Persona-Details für Chat

**POST `/v1/personas/generate`**
- Persona-Generierung für Chat

**GET `/health`**
- Health Check

**GET `/health/ready`**
- Readiness Check

### Indexing API (`/api/indexing`)

**POST `/upload`**
- Dokument hochladen und verarbeiten

**GET `/status/{job_id}`**
- Processing-Status

---

## Datenmodelle

### PostgreSQL Schema

#### Core Tables

**`documents`**
- `id` (UUID, PK)
- `filename` (String)
- `file_path` (String)
- `content_type` (String)
- `size_bytes` (Float)
- `status` (Enum: processing, completed, failed)
- `persona_id` (UUID, FK, nullable)
- `target_group_id` (UUID, FK, nullable)
- `uploaded_by` (String, nullable)
- `insight_summary` (Text, nullable)
- `created_at`, `updated_at` (DateTime)

**`document_chunks`**
- `id` (UUID, PK)
- `document_id` (UUID, FK)
- `knowledge_entry_id` (UUID, FK, nullable)
- `content` (Text)
- `chunk_metadata` (JSON)

**`processing_jobs`**
- `id` (UUID, PK)
- `document_id` (UUID, FK)
- `status` (Enum: pending, processing, completed, failed)
- `progress` (Float, 0.0-100.0)
- `error` (Text, nullable)
- `created_at`, `updated_at` (DateTime)

**`target_groups`**
- `id` (UUID, PK)
- `project_id` (UUID)
- `name` (String)
- `description` (Text, nullable)
- `segment` (String)
- `created_at`, `updated_at` (DateTime)
- `updated_by` (String, nullable)

**`personas`**
- `id` (UUID, PK)
- `project_id` (UUID)
- `name` (String)
- `segment` (String)
- `headline` (String)
- `profile` (JSON) - Vollständiges Persona-Profil
- `confidence` (Float, 0.0-1.0)
- `version` (String)
- `target_group_id` (UUID, FK, nullable)
- `status` (Enum: draft, published, archived)
- `image_url` (String, nullable)
- `profile_card` (JSONB, nullable)
- `created_at`, `updated_at` (DateTime)
- `updated_by` (String, nullable)
- `last_reviewed_at` (DateTime, nullable)
- `locked_by`, `locked_at` (nullable)

**`persona_prompts`**
- `id` (UUID, PK)
- `persona_id` (UUID, FK)
- `system_prompt` (Text)
- `template_version` (String)
- `created_at` (DateTime)

**`persona_sources`**
- `id` (UUID, PK)
- `persona_id` (UUID, FK)
- `chunk_id` (UUID, FK)
- `confidence` (Float)
- `rationale` (Text, nullable)

**`target_group_sources`**
- `id` (UUID, PK)
- `target_group_id` (UUID, FK)
- `chunk_id` (UUID, FK)
- `relevance_score` (Float)
- `rationale` (Text, nullable)
- `created_at` (DateTime)

**`target_group_knowledge_entries`**
- `id` (UUID, PK)
- `target_group_id` (UUID, FK)
- `title` (String)
- `content` (Text)
- `metadata_payload` (JSON, nullable)
- `created_by` (String)
- `created_at` (DateTime)

**`persona_knowledge_entries`**
- `id` (UUID, PK)
- `persona_id` (UUID, FK)
- `title` (String)
- `content` (Text)
- `metadata_payload` (JSON, nullable)
- `created_by` (String)
- `created_at` (DateTime)

**`persona_audit_logs`**
- `id` (UUID, PK)
- `persona_id` (UUID, FK)
- `action` (Enum: created, updated, published, archived, restored)
- `actor` (String)
- `payload_before` (JSON, nullable)
- `payload_after` (JSON, nullable)
- `created_at` (DateTime)

### Qdrant Collections

**`research_chunks`**
- Vector Size: 1024 (BGE-M3)
- Distance: Cosine
- Payload:
  - `chunk_id` (UUID)
  - `document_id` (UUID)
  - `target_group_id` (UUID, nullable)
  - `persona_segment` (String, nullable) - Backward Compatibility
  - `content` (String)
  - `metadata` (JSON)

### Neo4j Graph Schema

**Nodes:**
- `Persona` {id, name, segment}
- `TargetGroup` {id, name, segment}
- `Document` {id, filename}
- `Chunk` {id, content}
- `PainPoint` {name, description}
- `Goal` {name, description}
- `Topic` {name}

**Relationships:**
- `Persona` -[:BELONGS_TO]-> `TargetGroup`
- `Persona` -[:HAS_PAIN_POINT]-> `PainPoint`
- `Persona` -[:HAS_GOAL]-> `Goal`
- `Persona` -[:MENTIONED_IN]-> `Chunk`
- `Chunk` -[:FROM_DOCUMENT]-> `Document`
- `Chunk` -[:RELATES_TO]-> `Topic`

### Persona Schema (JSON)

Siehe: `knowledge/persona_schema.yaml`

**Kernfelder:**
- `persona_id` (String, UUID)
- `source_id` (String)
- `provenance` (Enum: internal, external, blended)
- `segment` (String)
- `demographics` (Object: age_range, gender, location, occupation)
- `goals` (List[String])
- `motivations` (List[String])
- `pain_points` (List[String])
- `behaviors` (List[String])
- `jobs_to_be_done` (List[String])
- `ux_metrics` (Object: satisfaction, effort, adoption)
- `preferences` (Object)
- `embeddings` (Object: text_model, vector, dim)
- `last_seen_at` (DateTime)
- `created_at` (DateTime)
- `metadata` (Object)

---

## Development-Workflow

### Code-Struktur

```
AUDION/
├── apps/
│   ├── api/              # Persona Backend API
│   │   ├── app/
│   │   │   ├── agents/   # AI Agents (Retrieval, Persona)
│   │   │   ├── core/     # Config, Logging, Telemetry
│   │   │   ├── models/   # SQLAlchemy Models
│   │   │   ├── routers/  # FastAPI Routes
│   │   │   ├── schemas/  # Pydantic Schemas
│   │   │   ├── services/ # Business Logic
│   │   │   └── ws/       # WebSocket Handlers
│   │   ├── worker/       # Celery Workers
│   │   └── alembic/      # Database Migrations
│   ├── chat-api/         # Real-time Chat Service
│   ├── indexing-api/     # Document Processing
│   └── web/              # Next.js Frontend
├── infrastructure/       # Docker Compose, Nginx
├── knowledge/            # Dokumentation, Schemas
├── packages/
│   ├── proto/           # Shared Protobuf Schemas
│   └── types/            # Shared TypeScript Types
└── data/                 # Uploaded Documents
```

### Development Commands

**Frontend:**
```bash
npm run dev:web          # Development Server
npm run build:web        # Production Build
npm run lint:web         # ESLint
npm run typecheck:web    # TypeScript Check
```

**Backend:**
```bash
# Persona API
cd apps/api
uv sync
uv run fastapi dev app/main.py --port 8000
uv run celery -A app.celery_app worker -Q ingestion -l INFO
uv run pytest

# Chat API
cd apps/chat-api
uv sync
uv run fastapi dev app/main.py --port 8001

# Indexing API
cd apps/indexing-api
uv sync
uv run fastapi dev app/main.py --port 8000
uv run celery -A app.workers.process worker -Q indexing -l info
```

**Datenbank:**
```bash
cd apps/api
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
uv run alembic downgrade -1
```

### Code-Qualität

**Linting:**
```bash
# Frontend
npm run lint:web

# Backend
cd apps/api && uv run ruff check .
cd apps/api && uv run mypy .
```

**Testing:**
```bash
# Frontend
npm test --workspaces

# Backend
cd apps/api && uv run pytest
```

### Git Workflow

**Branches:**
- `main` - Production
- Feature Branches für neue Features

**Commits:**
- Klare Commit-Messages
- Tests für neue Features
- Dokumentation aktualisieren

---

## Deployment

### Deployment-Optionen

**Aktuell:** Docker Compose auf eigenem Server
**Alternative:** Coolify (siehe `knowledge/coolify-deployment.md` für vollständigen Guide)

### Production Server

**Server:** `192.168.50.101`

### Deployment-Prozess

**1. Code aktualisieren:**
```bash
ssh user@192.168.50.101
cd /path/to/AUDION
git pull origin main
```

**2. Services neu bauen:**
```bash
cd infrastructure
WEB_RUN_BUILD=true docker compose build web
docker compose build persona-api chat-api indexing-api
```

**3. Services neu starten:**
```bash
docker compose up -d
```

**4. Logs prüfen:**
```bash
docker compose logs -f [service-name]
```

### Nginx Konfiguration

**Config:** `infrastructure/nginx/nginx.conf`

**Features:**
- HTTPS (Port 443)
- HTTP → HTTPS Redirect
- Reverse Proxy für alle Services
- WebSocket Support für Chat
- SSL Certificates in `infrastructure/nginx/ssl/`

### Datenbank-Migrationen

**Auf Production:**
```bash
cd apps/api
uv run alembic upgrade head
```

**Oder via Docker:**
```bash
docker compose exec persona-api uv run alembic upgrade head
```

### Backup-Strategie

**PostgreSQL:**
```bash
docker compose exec postgres pg_dump -U persona persona > backup.sql
```

**Qdrant:**
- Volumes werden in `qdrant-data` gespeichert
- Backup: Volume kopieren

**Neo4j:**
- Volumes werden in `neo4j-data` gespeichert
- Backup: Volume kopieren

### Monitoring

**Service Status:**
- Endpoint: `GET /api/persona-backend/queue/services/status`
- Prüft: PostgreSQL, Redis, Qdrant, Neo4j, Celery Workers

**Logs:**
- Docker Compose Logs: `docker compose logs -f`
- OpenTelemetry: Tempo (Port 4318)
- Logfire: Strukturierte Logs (optional)

---

## Testing

### Frontend Tests

**Unit Tests:**
```bash
npm test --workspaces
```

**Type Checking:**
```bash
npm run typecheck:web
```

**Linting:**
```bash
npm run lint:web
```

### Backend Tests

**Unit Tests:**
```bash
cd apps/api
uv run pytest tests/
```

**Integration Tests:**
- `test_documents_upload.py` - Document Upload Flow
- `test_ingestion_service.py` - Ingestion Pipeline
- `test_persona_service.py` - Persona CRUD
- `test_target_group_api.py` - Target Groups API

**Test Coverage:**
```bash
cd apps/api
uv run pytest --cov=app tests/
```

### Test-Datenbank

**Setup:**
```bash
# Separate Test-Datenbank verwenden
DATABASE_URL=postgresql+psycopg://persona:persona@localhost:55432/persona_test
```

### Contract Tests

**Persona Schema:**
- `tests/schema/test_persona_contract.py`
- Validiert gegen `knowledge/persona_schema.yaml`

---

## Troubleshooting

### Häufige Probleme

**1. Services starten nicht:**
```bash
# Prüfe Logs
docker compose logs [service-name]

# Prüfe Ports
docker compose ps

# Prüfe Environment-Variablen
docker compose exec [service] env
```

**2. Datenbank-Verbindungsfehler:**
```bash
# Prüfe PostgreSQL Status
docker compose exec postgres pg_isready

# Prüfe Connection String
echo $DATABASE_URL

# Test Connection
docker compose exec persona-api python -c "from app.db import engine; engine.connect()"
```

**3. Qdrant-Verbindungsfehler:**
```bash
# Prüfe Qdrant Status
curl http://localhost:6333/collections

# Prüfe Collection
curl http://localhost:6333/collections/research_chunks
```

**4. Celery Worker startet nicht:**
```bash
# Prüfe Redis
docker compose exec redis redis-cli ping

# Prüfe Worker Logs
docker compose logs persona-worker

# Starte Worker manuell
docker compose exec persona-worker celery -A app.celery_app worker -Q ingestion -l INFO
```

**5. Document Ingestion schlägt fehl:**
```bash
# Prüfe Job Status
curl http://localhost:8000/api/persona-backend/queue/jobs/{job_id}

# Prüfe Logs
curl http://localhost:8000/api/persona-backend/queue/logs?job_id={job_id}

# Retry Job
curl -X POST http://localhost:8000/api/persona-backend/personas/{persona_id}/documents/{document_id}/retry
```

**6. Build-Fehler:**
```bash
# Cache löschen
docker compose build --no-cache [service]

# Build mit Cache
LOCAL_DOCKER_CACHE_ROOT=/path/to/cache ./scripts/build.sh
```

**7. Frontend Build-Fehler:**
```bash
# Node Modules neu installieren
rm -rf node_modules apps/web/node_modules
npm install

# TypeScript Types neu bauen
npm run build --workspace packages/types

# Next.js Cache löschen
rm -rf apps/web/.next
```

### Debug-Modi

**Backend:**
```bash
# Debug Logging
APP_ENV=development uv run fastapi dev app/main.py --port 8000 --reload
```

**Frontend:**
```bash
# Verbose Logging
NODE_OPTIONS='--inspect' npm run dev:web
```

### Performance-Optimierung

**Qdrant:**
- Collection Size prüfen: `curl http://localhost:6333/collections/research_chunks`
- Index-Optimierung bei großen Collections

**PostgreSQL:**
- Indizes prüfen: `\d+ table_name` in psql
- Query Performance: `EXPLAIN ANALYZE`

**Redis:**
- Memory Usage: `docker compose exec redis redis-cli INFO memory`
- Cache TTL anpassen: `PERSONA_CACHE_TTL_SECONDS`

---

## Wichtige Konzepte

### Persona-Generierung

**Prozess:**
1. Retrieval: Relevante Chunks aus Target Group Knowledge
2. Sampling: Gewichtete Auswahl basierend auf Relevance Score
3. LLM Calls (Claude):
   - Call 1: Core Identity (Name, Alter, Job, Bio, Persönlichkeit)
   - Call 2: Detailed Attributes (Tagesablauf, Entscheidungsprozess, Bedenken)
   - Call 3: Communication Style (Vokabular, Phrasen, typische Fragen)
   - Call 4: System Prompt Engineering (Verhaltensregeln, Authentizitätsrichtlinien)
4. Storage: Persona in DB, System Prompt in `persona_prompts`

**Variationen:**
- Zufällige Persona-Generierung mit Variation Parameters
- `variation_params`: `{"skepticism": 0.9, "tech_affinity": 0.3}`

### Retrieval Agent

**Prozess:**
1. Query Embedding: BGE-M3 Embedding für User-Query
2. Vector Search: Qdrant Search mit Filter (target_group_id oder persona_segment)
3. Graph Search: Neo4j für verbundene Entities (Pain Points, Goals)
4. Ranking: Kombination aus Vector Similarity und Graph Relevance
5. Top-K Selection: Top 5-10 Chunks für Context

**Filter-Priorität:**
1. `target_group_id` (neu, bevorzugt)
2. `persona_segment` (Backward Compatibility)

### Target Groups vs. Personas

**Target Groups:**
- Container für verwandte Personas
- Knowledge auf Target Group Ebene
- Mehrere Persona-Varianten möglich

**Personas:**
- Konkrete Instanzen innerhalb einer Target Group
- Eigene System Prompts
- Eigene Sources (optional, meist aus Target Group)

**Migration:**
- Bestehende Personas bekommen automatisch Target Groups
- Segment-basierte Gruppierung
- Siehe: `knowledge/target_group_migration.md`

### Knowledge Management

**Target Group Knowledge:**
- Gemeinsam für alle Personas einer Target Group
- Manuell erstellbar via API
- Wird für Persona-Generierung verwendet

**Persona Knowledge:**
- Spezifisch für eine Persona
- Optional, für zusätzliche Kontext-Informationen

**Knowledge Ingestion:**
- Automatische Chunking und Embedding
- Speicherung in Qdrant
- Verknüpfung mit Target Group

### Caching

**Persona Cache:**
- TTL: `PERSONA_CACHE_TTL_SECONDS` (Default: 300s)
- Invalidation: Bei Updates, Document Uploads, Knowledge Changes
- Redis-basiert

**Embedding Cache:**
- BGE-M3 Model wird lazy-loaded
- Singleton Pattern für Embedder-Instanz

### Observability

**OpenTelemetry:**
- Endpoint: `OTEL_EXPORTER_OTLP_ENDPOINT` (Default: `http://tempo:4318`)
- Traces: Tempo
- Metrics: (Optional)

**Logging:**
- Structured Logging: structlog
- Logfire: Optional, für erweiterte Logs
- Log Levels: INFO, WARNING, ERROR

**Health Checks:**
- `/health` - Basic Health Check
- `/health/ready` - Readiness Check (inkl. DB Connections)
- `/queue/services/status` - Service Status Overview

---

## Weitere Ressourcen

### Dokumentation

- `initial_concept.md` - Ursprüngliches Konzept und Vision
- `knowledge/persona_schema.yaml` - Persona Schema Definition
- `knowledge/target_group_migration.md` - Target Groups Migration Guide
- `knowledge/env.md` - Environment Variables
- `knowledge/build-cache.md` - Build Cache Konfiguration
- `knowledge/ui.md` - UI Components und Branding
- `knowledge/persona_sources.md` - Externe Persona-Datenquellen
- `knowledge/coolify-deployment.md` - Coolify Deployment Guide
- `Docs/` - Weitere technische Dokumentation

### API-Dokumentation

- Persona Backend: `https://192.168.50.101/api/persona-backend/docs`
- Chat API: `http://localhost:8001/docs` (Development)
- Indexing API: `http://localhost:8000/docs` (Development)

### Repository

- GitHub: `https://github.com/chbrdk/msqdx-audion`
- Siehe: `knowledge/repos.md`

---

## Changelog

### November 2025

- **Journey Mapper**: Customer Journey Maps mit AI-Generierung, Persona Validation und Reality Tracking
- **Target Groups**: Neue Architektur für Persona-Organisation
- **Queue Dashboard**: Monitoring für Processing Jobs
- **Service Status**: Health Checks für alle Services
- **Build Optimization**: Build-Zeiten von 20+ min auf <5 min reduziert
- **Knowledge Explorer**: Visualisierung von Knowledge Chunks

---

## Journey Mapper Feature

Das Journey Mapper Feature ermöglicht die Erstellung und Verwaltung von Customer Journey Maps mit folgenden Funktionen:

### Features

- **Drei Creation-Modi:**
  - **Manual**: Manuelle Erstellung von Journeys und Phasen
  - **AI-generiert**: Automatische Generierung aus Target Group Knowledge und Personas
  - **Hybrid**: Kombination aus manuellen und AI-generierten Phasen

- **Persona Validation:**
  - Validierung von Journey Phases gegen Persona Profiles
  - Fit Scores (0-100) pro Phase
  - Identifikation von Friction Points
  - Automatische Recommendations

- **Reality Tracking:**
  - Expectations vs. Measurements
  - Integration mit GA4, Hotjar, HubSpot
  - Automatisches Syncing von Measurements
  - Status-Tracking (good, warning, critical, no_data)

- **Insights & Learning:**
  - Automatische Insights-Generierung aus Measurements
  - Insight-Typen: Confirmation, Contradiction, Discovery, Anomaly
  - AI-basierte Recommendations
  - Change Tracking

### Integration

- **Target Groups**: Journeys gehören zu Target Groups (wie Personas)
- **Personas**: Validation nutzt bestehende Persona Profiles
- **Knowledge Base**: Journey Generation nutzt Target Group Knowledge und RetrievalAgent

### API Endpoints

Siehe: `knowledge/journey_mapper.md` für vollständige API-Dokumentation.

**Base URL:** `/api/persona-backend/journeys`

### Frontend

- **Pages:** `/admin/journeys` (List), `/admin/journeys/[journeyId]` (Editor), `/admin/journeys/[journeyId]/dashboard` (Dashboard)
- **Components:** `msqdx-glass-journey-canvas`, `msqdx-glass-phase-card`, `msqdx-glass-validation-panel`

### Celery Tasks

- **Queue `journeys`**: Journey generation and validation
- **Queue `analytics`**: Measurement syncing and insight analysis
- **Scheduled Tasks**: Daily sync and analysis at 2 AM / 3 AM

Siehe: `knowledge/journey_mapper.md` für detaillierte Dokumentation.

---

**Letzte Aktualisierung:** 2025-11-26

**Version:** 1.1.0
