# AUDION MCP Server

MCP (Model Context Protocol) server that exposes AUDION FastAPI APIs as tools. Supports two transports:

- **Streamable HTTP** (default): for Cursor, Coolify, or any HTTP-based MCP client.
- **stdio**: for Claude Desktop; Claude starts the server as a subprocess and talks over stdin/stdout.

## Requirements

- Node 20+
- AUDION API with API token (Bearer) auth. Create tokens in AUDION Settings → API access (or `POST /auth/tokens`).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUDION_API_URL` | Yes | Base URL of the AUDION FastAPI API (e.g. `http://api:8000`, `https://api.audion.example.com`). No trailing slash. |
| `AUDION_API_TOKEN` | Yes | API token (Bearer) created in AUDION (Settings → API access). One token for MCP and all services. |
| `MCP_TRANSPORT` | No | `stdio` for Claude Desktop; omit or `http` for Streamable HTTP |
| `MCP_PORT` | No | Port for HTTP mode (default: `3100`) |
| `MCP_STATELESS` | No | Set to `true` or `1` for stateless HTTP. **Recommended when MCP is behind the Next.js proxy** (`/mcp`), so the client does not need to send `Mcp-Session-Id`. |

## Running locally

**HTTP mode** (e.g. for Cursor or test client):

```bash
npm install
export AUDION_API_URL=http://localhost:8000
export AUDION_API_TOKEN=audion_xxxx   # from AUDION Settings → API tokens
npm run dev
# or: npm run build && npm start
```

Server listens on `http://localhost:3100` (or `MCP_PORT`).

**stdio mode** (for Claude Desktop):

```bash
npm run build
MCP_TRANSPORT=stdio AUDION_API_URL=https://api.audion.example.com AUDION_API_TOKEN=audion_xxx node dist/index.js
# or: npm run start:stdio  (set AUDION_API_URL and AUDION_API_TOKEN in Claude config env)
```

## Claude Desktop

- **Remote MCP**: Deploy the MCP server (e.g. Coolify), then use `uvx mcp-proxy --transport streamablehttp https://your-mcp-url` in Claude config so Claude starts only the proxy; the real server and token stay remote.
- **Local MCP**: If you have the repo locally, set Claude to run `npx tsx /path/to/mcp-server/src/index.ts` with `MCP_TRANSPORT=stdio`, `AUDION_API_URL`, and `AUDION_API_TOKEN` in env.

## Tools (by domain)

### Health
| Tool | Description |
|------|-------------|
| `audion.health` | GET /health |

### Auth
| Tool | Description |
|------|-------------|
| `audion.auth_me` | GET /auth/me – current user |
| `audion.auth_me_patch` | PATCH /auth/me – update profile |
| `audion.auth_tokens_list` | GET /auth/tokens |
| `audion.auth_tokens_create` | POST /auth/tokens |
| `audion.auth_tokens_revoke` | DELETE /auth/tokens/:id |

### Projects
| Tool | Description |
|------|-------------|
| `audion.projects_list` | GET /projects |
| `audion.project_get` | GET /projects/:id |
| `audion.project_create` | POST /projects |
| `audion.project_update` | PATCH /projects/:id |
| `audion.project_member_add` | POST /projects/:id/members |
| `audion.project_member_remove` | DELETE /projects/:id/members/:member_id |
| `audion.project_research_start` | POST /projects/:id/research/start |
| `audion.project_research_latest` | GET /projects/:id/research/latest |
| `audion.project_research_status` | GET /projects/:id/research/status?run_id= |
| `audion.project_suggest_target_groups` | POST /projects/:id/suggest-target-groups |
| `audion.project_checkion_site_topics` | GET /projects/:id/integrations/checkion/site-topics |
| `audion.project_bootstrap` | POST /projects/bootstrap (easy setup) |

### Personas
| Tool | Description |
|------|-------------|
| `audion.personas_list` | GET /personas |
| `audion.persona_get` | GET /personas/:id |
| `audion.persona_create` | POST /personas |
| `audion.persona_patch` | PATCH /personas/:id |
| `audion.persona_delete` | DELETE /personas/:id |
| `audion.personas_generate` | POST /personas/generate |
| `audion.persona_ai_pain_points` | POST /personas/:id/ai/pain-points |
| `audion.persona_ai_interests` | POST /personas/:id/ai/interests |
| `audion.persona_ai_values` | POST /personas/:id/ai/values |
| `audion.persona_ai_goals` | POST /personas/:id/ai/goals |

### Target groups
| Tool | Description |
|------|-------------|
| `audion.target_groups_list` | GET /target-groups |
| `audion.target_group_get` | GET /target-groups/:id |
| `audion.target_group_create` | POST /target-groups |
| `audion.target_group_patch` | PATCH /target-groups/:id |
| `audion.target_group_delete` | DELETE /target-groups/:id |
| `audion.target_group_knowledge_chunks` | GET /target-groups/:id/knowledge/chunks |
| `audion.target_group_knowledge_clusters` | GET /target-groups/:id/knowledge/clusters |
| `audion.target_group_knowledge_list` | GET /target-groups/:id/knowledge |
| `audion.target_group_knowledge_create` | POST /target-groups/:id/knowledge |
| `audion.target_group_documents_list` | GET /target-groups/:id/documents |
| `audion.target_group_personas_list` | GET /target-groups/:id/personas |
| `audion.target_group_suggest_personas` | POST /target-groups/:id/suggest-personas |
| `audion.target_group_personas_generate` | POST /target-groups/:id/personas/generate |

### Journeys
| Tool | Description |
|------|-------------|
| `audion.journeys_generate` | POST /journeys/generate |
| `audion.journeys_list` | GET /journeys |
| `audion.journey_get` | GET /journeys/:id |
| `audion.journey_update` | PUT /journeys/:id |
| `audion.journey_delete` | DELETE /journeys/:id |
| `audion.journey_phases_create` | POST /journeys/:id/phases |
| `audion.journey_validate` | POST /journeys/:id/validate |
| `audion.journey_validation_report` | GET /journeys/:id/validation-report |
| `audion.journey_measurements` | GET /journeys/:id/measurements |
| `audion.journey_insights` | GET /journeys/:id/insights |
| `audion.journey_changes_list` | GET /journeys/:id/changes |

### AI-Assist
| Tool | Description |
|------|-------------|
| `audion.ai_assist_templates` | GET /ai-assist/templates |
| `audion.ai_assist_assist` | POST /ai-assist |
| `audion.ai_assist_test` | POST /ai-assist/test |

### Settings
| Tool | Description |
|------|-------------|
| `audion.settings_ai_providers` | GET /settings/ai/providers |
| `audion.settings_ai_templates_list` | GET /settings/ai/templates |

### Documents
| Tool | Description |
|------|-------------|
| `audion.documents_job_status` | GET /documents/:job_id/status |

### Queue
| Tool | Description |
|------|-------------|
| `audion.queue_jobs_list` | GET /queue/jobs |
| `audion.queue_job_get` | GET /queue/jobs/:job_id |
| `audion.queue_stats` | GET /queue/stats |
| `audion.queue_service_status` | GET /queue/service-status |

## Docker / Coolify

Build from repo root (context `.`):

```bash
docker build -f Dockerfile.mcp-server -t audion-mcp .
docker run -e AUDION_API_URL=http://api:8000 -e AUDION_API_TOKEN=audion_xxx -p 3100:3100 audion-mcp
```

In Coolify: set Dockerfile path to `Dockerfile.mcp-server`, build context to repo root. Configure `AUDION_API_URL` and `AUDION_API_TOKEN`. For same-domain access, set `MCP_SERVER_URL` in the **web app** to the internal MCP service URL and use rewrites so clients call `https://audion.example.com/mcp`.

## Troubleshooting

- **500 on /mcp**: Ensure `MCP_STATELESS=true` when behind Next.js proxy; check `MCP_SERVER_URL` in the web app.
- **Configuration errors from tools**: Set `AUDION_API_URL` and `AUDION_API_TOKEN` in the MCP server environment.
- **401 from API**: Token invalid or revoked; create a new token in AUDION Settings → API access.
