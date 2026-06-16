# AUDION – URLs and paths (central reference)

Do not hardcode URLs or path prefixes in code. Use environment variables and this document as the single reference.

## Environment variables

### API (FastAPI backend)

| Variable | Used by | Description |
|----------|--------|-------------|
| `AUDION_API_URL` | MCP server, external clients | Base URL of the **FastAPI API** (e.g. `http://api:8000`, `https://api.audion.example.com`). No trailing slash. **In der docker-compose** ist der API-Service Name `api` → URL = **`http://api:8000`**. **Nicht** die Web-App-URL – wenn die Web-App-URL verwendet wird, antwortet die Next.js-Middleware mit Redirect zu `/login` statt JSON. |
| `NEXT_PERSONA_BACKEND_INTERNAL_URL` | AUDION web (Next.js, server-side) | Internal URL of the FastAPI API when the web app proxies requests (e.g. `http://api:8000`). |
| `NEXT_PUBLIC_PERSONA_BACKEND_URL` | AUDION web (optional, public) | Public URL of the API when the client or server needs to reach it via a public host. |
| `NEXT_PUBLIC_PERSONA_BACKEND_DOCS_URL` | AUDION web | URL to the API docs (e.g. `/docs`). |

### MCP server

| Variable | Used by | Description |
|----------|--------|-------------|
| `MCP_SERVER_URL` | AUDION web (Next.js rewrites) | Internal URL of the MCP server for the `/mcp` rewrite (e.g. `http://audion-mcp:3100`). Set in the **web app** env, not in the MCP container. |
| `MCP_PORT` | MCP server | Port for HTTP transport (default: 3100). |
| `MCP_TRANSPORT` | MCP server | `stdio` for Claude Desktop; omit or `http` for Streamable HTTP. |
| `MCP_STATELESS` | MCP server | Set to `true` when MCP is behind the Next.js proxy (recommended). |
| `AUDION_API_URL` | MCP server | Base URL of the FastAPI API (see above). |
| `AUDION_API_TOKEN` | MCP server | Bearer token (API token from Settings → API access, or JWT). |
| `CHAT_API_URL` | MCP server | Chat API base for `audion.chat_*` tools (e.g. `http://audion-chat-api:8001`). |
| `AUDION_CHAT_API_URL` | MCP server | Alias for `CHAT_API_URL`. |

### Chat / Voice / Indexing

| Variable | Used by | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_CHAT_API_URL` | AUDION web | Chat API base URL (server-side fallback). MCP uses `CHAT_API_URL` (see MCP server table above). |
| `NEXT_PUBLIC_VOICE_API_URL` | AUDION web | Voice API base URL (server-side fallback). |
| `NEXT_PUBLIC_INDEXING_API_URL` | AUDION web | Indexing API URL. |
| `INDEXING_API_URL` | AUDION web / services | Indexing API URL (internal). |

### Web app

| Variable | Used by | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_BASE_PATH` | AUDION web | Base path for the app (e.g. `/audion` or ``). Used in `buildApiUrl()` and routing. |

## API path prefixes (FastAPI)

The FastAPI app mounts routers at the following prefixes. **No** `/api` prefix; the Next.js app may proxy `/api/*` to the backend, but the backend routes are:

- `/health` – health check
- `/auth` – login, register, me, password, **tokens** (API token CRUD)
- `/projects` – projects CRUD, members
- `/personas` – personas CRUD, generate, AI (pain-points, interests, values, goals)
- `/target-groups` – target groups, knowledge, documents, personas
- `/journeys` – journeys, phases, elements, expectations, validate, tracking, measurements, insights, changes
- `/ai-assist` – templates, assist, test
- `/settings` – AI providers, templates
- `/documents` – upload, status, list
- `/queue` – jobs, stats, service status

Persona admin (avatar etc.) is under a separate router; see `main.py` and router prefix (e.g. `/api/persona-admin` if used).

## MCP client (tools)

The MCP server calls the FastAPI API with `AUDION_API_URL` + path. Paths are exactly as above (e.g. `GET /auth/me`, `GET /projects`, `POST /auth/tokens`). No `/api` in the path.

## Web app API routes (Next.js)

The web app uses `buildApiUrl(path)` which prepends `NEXT_PUBLIC_BASE_PATH`. Paths like `/api/auth/me` are then forwarded to the backend by the Next.js API routes; the backend still sees the path as defined by the proxy (e.g. `/auth/me` or `/api/auth/me` depending on proxy config). See `apps/web/app/api/_lib/backend.ts` for how the backend base URL is chosen (internal vs public).

**API token management (same pattern as CHECKION):** Central constants in `apps/web/app/api/_lib/backend.ts`: `API_AUTH_TOKENS` (GET/POST list and create), `apiAuthTokenRevoke(id)` (DELETE). Used on the profile page at **Admin → Profil** (API-Zugang / API access). All token fetches use `credentials: 'include'` so the session cookie is sent.

**Chat API proxy:** Next rewrites `/api/chat/:path*` to chat-api `/chat/:path*` (`next.config.mjs`). Use `getChatApiBase()` and helpers in `apps/web/app/api/_lib/backend.ts` (e.g. `buildChatDocumentsUploadUrl` for `POST …/documents/upload`). See `knowledge/chat-document-upload.md` for DOCX attachments.
