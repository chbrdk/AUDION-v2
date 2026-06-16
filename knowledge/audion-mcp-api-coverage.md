# AUDION MCP – API-Abdeckung (Stand 2026-06-16)

Vergleich: **FastAPI** (`apps/api`) vs. **MCP-Server** (`mcp-server/src/tools.ts`).

| Metrik | Wert |
|--------|------|
| API-Routen (geschätzt) | ~157 |
| MCP-Tools (vor Update) | 55 |
| MCP-Tools (nach Update) | 78 |
| Abdeckung (rough) | ~40 % der Routen, ~80 % der Orchestrator-relevanten Flows |

Regenerieren: Python-Route-Scan in `apps/api` + `rg "registerTool" mcp-server/src/tools.ts`.

## Neu in diesem Update (MCP)

### Audience / Orchestration (vorheriger Stand)

| Tool | API |
|------|-----|
| `audion.project_suggest_target_groups` | POST `/projects/{id}/suggest-target-groups` |
| `audion.project_research_latest` | GET `/projects/{id}/research/latest` |
| `audion.project_research_status` | GET `/projects/{id}/research/status` |
| `audion.project_checkion_site_topics` | GET `/projects/{id}/integrations/checkion/site-topics` |
| `audion.project_bootstrap` | POST `/projects/bootstrap` |
| `audion.target_group_suggest_personas` | POST `/target-groups/{id}/suggest-personas` |
| `audion.target_group_personas_generate` | POST `/target-groups/{id}/personas/generate` |

### UX Journey Agent (`AUDION_API_URL`)

| Tool | API |
|------|-----|
| `audion.ux_journey_run_start` | POST `/ux-journey-agent/run` |
| `audion.ux_journey_run_get` | GET `/ux-journey-agent/run/{job_id}` |
| `audion.ux_journey_run_cancel` | POST `.../cancel` |
| `audion.ux_journey_run_video_finalize` | POST `.../video/finalize` |
| `audion.ux_journey_run_live_diag` | GET `.../live/diag` |
| `audion.ux_journey_step_screenshot` | GET `.../step/{n}/screenshot` (base64) |
| `audion.ux_journey_live_frame` | GET `.../live` (base64 JPEG) |
| `audion.persona_admin_ux_journey_runs_list` | GET `/api/persona-admin/{id}/ux-journey-runs` |
| `audion.persona_admin_ux_journey_run_upsert` | POST `/api/persona-admin/{id}/ux-journey-runs` |
| `audion.persona_admin_ux_journey_run_convert` | POST `.../convert` |

Live-Video-Streams (`/live/stream`, `/video`) bleiben bewusst außerhalb MCP – Status + Screenshots nutzen.

### Persona Chat (`CHAT_API_URL`, z. B. `http://audion-chat-api:8001`)

| Tool | API |
|------|-----|
| `audion.chat_health` | GET `/health/` |
| `audion.chat_message` | POST `/chat/message` |
| `audion.chat_tool_call_decision` | POST `/chat/tool-call/decision/{call_id}` |
| `audion.chat_history_upsert` | POST `/chat/history/conversations/upsert` |
| `audion.chat_history_append_message` | POST `/chat/history/conversations/{id}/messages` |

Ohne `CHAT_API_URL` registriert der MCP nur `audion.chat_status` (Hinweis zur Konfiguration).
SSE (`/chat/message/stream`) und WebSocket bleiben UI-/SDK-Pfade.

## Bugfix

| Tool | War | Jetzt |
|------|-----|-------|
| `audion.ai_assist_assist` | POST `/ai-assist/assist` (404) | POST `/ai-assist` |

## Gut abgedeckt (MCP vorhanden)

- Auth (`/auth/me`, Tokens)
- Projekte CRUD, Members, Research start
- Target Groups CRUD + Knowledge (read/create)
- Personas CRUD, generate, AI-Felder (pain-points, goals, …)
- Journeys (generate, CRUD, validate, insights, …)
- AI-Assist templates, Queue, Documents job status
- Settings AI providers/templates (read)

## Wichtige Lücken (noch ohne MCP)

### PLEXON / CHECKION ↔ AUDION

| Route | Grund |
|-------|--------|
| `GET /integrations/checkion/projects/{id}/audience-report` | Service-Token (`CHECKION_INBOUND_SERVICE_TOKEN`), nicht User-API-Token |
| `PUT /integrations/checkion/projects/{id}/link` | dito |
| `GET /integrations/checkion/audion-projects` | dito |

→ Für PLEXON: CHECKION-Daten über **CHECKION-MCP**, AUDION-Schreiben über **AUDION-MCP**; Audience-Report ggf. serverseitig in PLEXON.

### Personas (erweitert)

- Documents upload/download/retry, enrich, avatar, knowledge
- Moodboards / Tavus / UX-Journey-Runs
- `/api/persona-admin/*` (Admin-UI-Pfade)
- `POST /personas/tavus/session`, translate-fields

### Target groups

- `POST /target-groups/{id}/documents` (Multipart-Upload)
- `PUT/DELETE /target-groups/{id}/knowledge/{id}`
- `GET .../knowledge/chunks/{id}/similar`

### Projekte

- `POST /projects/{id}/plexon-mirror`
- `POST /projects/{id}/generate-journey`
- `GET /projects/{id}/research/stream` (SSE – ungeeignet für MCP)

### Journeys (Detail)

- Phasen/Elemente CRUD, reorder, tracking, `from-ux-run`, AI generate phase

### UX Journey Agent

- Live-Streams (`/live/stream`, `/video`) – nicht im MCP; Run-Status + Screenshots abgedeckt

### Persona Chat

- `POST /chat/message/stream` (SSE), WS `/ws/chat/*` – nicht im MCP; synchrones `audion.chat_message` nutzen

## Empfohlene PLEXON-Flows (nach Update)

1. CHECKION: Projekt/Scans/GEO lesen (`checkion.*`)
2. AUDION: `audion.project_get` + `audion.project_checkion_site_topics`
3. AUDION: `audion.project_suggest_target_groups` **oder** manuell `audion.target_group_create`
4. Optional: `audion.target_group_suggest_personas` / `audion.target_group_personas_generate`

## Deployment

Nach Änderungen am MCP: **audion-mcp**-Container in Coolify neu bauen/deployen.

**MCP Env (zusätzlich):**

- `CHAT_API_URL=http://audion-chat-api:8001` (interner Service-Name aus `docker-compose`)
- `AUDION_API_TOKEN` – gleicher Token wie für FastAPI

Siehe auch: `knowledge/audion-mcp-server.md`, `knowledge/audion-urls-and-paths.md`, `mcp-server/README.md`.
