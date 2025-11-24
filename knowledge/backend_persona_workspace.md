# Backend Persona Workspace (2025-11-20)

## Runtime Topology
- `apps/api` (FastAPI 0.121.3, verified via `curl https://pypi.org/pypi/fastapi/json`) exposes REST + WS for persona management at `http://0.0.0.0:8000`.
- Companion services from `infrastructure/compose.yml`:
  - PostgreSQL 17 → `postgresql://persona:persona@localhost:55432/persona`.
  - Redis 7 (cache/jobs) → `redis://localhost:6380/0`.
  - Qdrant v1.11.3 → `http://localhost:6333`.
  - Neo4j 5.22 (bolt `bolt://localhost:7687`, http `http://localhost:7474`).
  - MinIO (S3-compatible object store) exposed on `http://localhost:9000` (console `http://localhost:9001`) with bucket `persona-research` for persona documents/avatars.
  - Tempo OTLP collector → `http://localhost:4318`.
  - Web frontend Next.js → `http://localhost:3000` (internal APIs via `NEXT_*_INTERNAL_URL` routing through nginx proxy `https://192.168.50.101` per compose).

## Code Entry Points
- FastAPI startup `apps/api/app/main.py` wires routers `documents`, `personas`, and WS `chat`.
- Database models defined in `apps/api/app/models/__init__.py`; persona tables now include metadata (status, locks, avatar URL) plus `persona_knowledge_entries` for appended knowledge.
- Settings come from `apps/api/app/core/config.py` (Pydantic settings pulling `.env`, including `database_url`, `redis_url`, `qdrant_url`, `neo4j_uri`, `neo4j_browser_url`, etc.) → prefer referencing these env keys instead of hardcoding endpoints.

## Data Flow (Persona Read/Update)
1. REST request hits FastAPI router (`app/routers/personas.py`) and is delegated to `PersonaService`.
2. `PersonaService` loads SQLAlchemy models plus latest prompt + sources, hydrates Pydantic schemas, and memoizes via Redis cache (cache-aside, TTL configurable).
3. Insights builder consults Qdrant + Neo4j (best-effort) to enrich persona detail responses; fallbacks keep API resilient when downstreams degrade.
4. Mutations (create/update/archive) persist audit rows, emit structlog events (`persona.create|update|archive`), invalidate Redis cache, and allow future hooks (Celery, WS streaming) to subscribe.

- `GET /personas` – Pagination/filter (project, status, query) returning `PersonaListResponse`.
- `POST /personas` – Manual creation (optional prompt) with audit + cache warm.
- `GET /personas/{id}` – Aggregated profile/prompt/sources + documents/knowledge + insights + Neo4j links.
- `PATCH /personas/{id}` – Partial updates (draft/publish, locks, prompt, avatar URL) with audit + cache invalidation.
- `DELETE /personas/{id}` – Soft archive toggling status → `archived`.
- `POST /personas/generate` – Existing pipeline now reuses enriched response builder for consistency.
- `GET/POST /personas/{id}/documents` – Upload binary sources (S3-backed) and list raw files with presigned download links + insight summaries.
- `GET /personas/{id}/documents/{docId}/download` – Streams document payload via FastAPI (no direct MinIO URL) for HTTPS-safe downloads.
- `GET/POST /personas/{id}/knowledge` – Append textual knowledge (title/content/metadata) and list historical entries.
- `GET /personas/{id}/avatar` – Stream avatar image via FastAPI; `POST /personas/{id}/avatar` uploads replacement asset.

## Config Keys (centralized)
- `PERSONA_CONSOLE_BASE_URL` → defaults `http://localhost:3000`, consumed via `settings.persona_console_base_url`.
- `PERSONA_MEDIA_BASE_PATH` → defaults `/personas`, used for future asset references.
- `PERSONA_CACHE_TTL_SECONDS` → default `300`, controls Redis cache lifetime for persona detail payloads.
- `PERSONA_BACKEND_PUBLIC_URL` → default `http://localhost:8000`, set to `https://192.168.50.101/api/persona-backend` in Docker so generated download/avatar URLs stay HTTPS-safe.
- `PERSONA_BACKEND_DOCS_URL` → default `http://localhost:8000/docs`, surfaced in admin console links.
- Nginx proxy enforces `client_max_body_size 200m`, so uploads to `/api/persona-backend` (documents, knowledge attachments, avatars) avoid 413 responses for larger files.
- `NEO4J_BROWSER_URL` / `NEO4J_BLOOM_URL` → optional deep links for graph introspection; response metadata exposes `graphUrl` + `graphBloomUrl`.

## Access URLs
- Local dev: `http://localhost:8000/docs` (FastAPI docs) once `uv run fastapi dev app/main.py --port 8000` or `docker compose up persona-api`.
- Staging via nginx: `https://192.168.50.101/api/persona-backend` (proxied to `persona-api` service). Save this in `PERSONA_BACKEND_PUBLIC_URL` and reference in clients instead of hardcoding.
- Persona Admin UI: `https://192.168.50.101/personas/admin` (Next.js app consuming persona backend via `/api/persona-backend`). Links to API docs at `https://192.168.50.101/api/persona-backend/docs`.

## Knowledge Architecture: Dokumente, Wissensbasis, Sources

Das System verwaltet Wissen für Personas in drei Ebenen:

### 1. **Dokumente** (`Document` Model)
- **Was**: Die hochgeladenen Rohdateien (PDF, DOCX, PPTX, Audio, etc.)
- **Speicherort**: S3-compatible Storage (MinIO) via `object_key`
- **Status**: `processing` → `completed` / `failed` (via `ProcessingJob`)
- **Zugriff**: `GET /personas/{id}/documents/{docId}/download` streamt die Datei
- **Zweck**: Persistente Speicherung der Originaldateien für spätere Referenz

### 2. **Wissensbasis** (Qdrant Vector DB + `DocumentChunk` Model)
- **Was**: Die verarbeiteten, vektorisierten Textchunks aus den Dokumenten
- **Speicherort**: 
  - Qdrant Collection `research_chunks` (Vektoren + Payloads mit `document_id`, `chunk_id`, `persona_id`, `content`)
  - PostgreSQL `document_chunks` Tabelle (Metadaten: `order`, `length`)
- **Erstellung**: Automatisch via `IngestionService.ingest()` nach Dokument-Upload
  - Partitionierung via `unstructured.partition.auto`
  - Embeddings via BGE-M3 (`BAAI/bge-m3`)
  - Chunking in 800-1200 Token Segmente
- **Zweck**: Semantische Suche für Retrieval-Agent (findet relevante Chunks für User-Fragen)
- **Filterung**: Qdrant-Payloads enthalten optional `persona_id` für persona-spezifische Filterung

### 3. **Sources** (`PersonaSource` Model)
- **Was**: Verknüpfungen zwischen Personas und spezifischen Chunks
- **Speicherort**: PostgreSQL `persona_sources` Tabelle
- **Erstellung**: 
  - Automatisch bei Persona-Generierung (Seed-Chunks)
  - Manuell via API (z.B. wenn User explizit Chunks zuweist)
- **Zweck**: 
  - Tracking: Welche Chunks wurden für diese Persona verwendet?
  - Audit: Nachvollziehbarkeit der Persona-Generierung
  - Confidence: Jede Source hat ein `confidence` Score
- **Verwendung**: Wird im Retrieval-Agent genutzt, um persona-relevante Chunks zu priorisieren

### Workflow: Dokument → Wissen
```
User uploads PDF → Document (status="processing")
  ↓
ProcessingJob created → Celery Task enqueued
  ↓
IngestionService.ingest():
  - Partition document → text chunks
  - Generate embeddings (BGE-M3)
  - Store chunks in PostgreSQL (DocumentChunk)
  - Index vectors in Qdrant (with persona_id in payload)
  - Update Document.status="completed"
```

### Zusätzliche Wissensquellen
- **PersonaKnowledgeEntry**: Manuell hinzugefügtes Wissen (Text, Titel, Metadaten)
  - Aktuell nur in PostgreSQL gespeichert
  - **TODO**: Könnte auch in Qdrant indexiert werden für semantische Suche

### Zusammenfassung
- **Dokumente** = Rohdateien (S3)
- **Wissensbasis** = Vektorisierte Chunks (Qdrant + PostgreSQL)
- **Sources** = Persona-Chunk-Verknüpfungen (PostgreSQL, für Tracking/Audit)

Alle drei Ebenen dienen demselben Ziel: Wissen für das LLM bereitstellen, aber auf unterschiedlichen Abstraktionsebenen.

## Open Items
- Streaming notifications + Celery re-index hooks still pending (Plan §5), but logging + caching groundwork is in place.
- **PersonaKnowledgeEntry** könnte auch in Qdrant indexiert werden für semantische Suche (aktuell nur PostgreSQL).

