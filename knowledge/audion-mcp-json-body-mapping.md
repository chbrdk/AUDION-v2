# AUDION MCP ↔ audion-v3 body mapping

Coolify **audion-mcp** (`AUDION-v2/mcp-server`) talks to audion-v3 Next `/api/*`.

## Rules

1. **Never** put `actorUserId` in the HTTP JSON body — only as `X-Plexon-User-Id` (via `audionActorStore`).
2. Tool args may use FastAPI-era **snake_case** (`project_id`). Contracts use **camelCase** (`projectId`).
3. Shared helper: `mcp-server/src/mcp-json-body.ts` (`jsonBodyFromToolArgs` / `jsonBodyString` / `resolveProjectId`).
4. Next routes that require a project binding accept **both** casings where assistant writes matter:
   - `POST /api/personas`
   - `POST /api/target-groups`
   - `POST /api/journeys`
   - `POST /api/studies` (optional `projectId`)

## Regression

- `projectId is required` while the tool clearly had `project_id` → body mapping / alias missing.
- Unexpected `actorUserId` in API validation errors → body not stripped.
