# Tavus Video Chat (CVI) Integration

## Purpose

Tavus.io provides a **Conversational Video Interface (CVI)** for real-time video calls with AI replicas. AUDION integrates Tavus as a third chat option in the admin chat (alongside **Text** and **Voice**): when "Video (Tavus)" is enabled, the UI embeds the Tavus CVI so users can have a video conversation with the persona’s replica.

## Architecture

- **Persona mapping**: Each persona can have optional `tavus_replica_id` (and `tavus_persona_id`) stored in the database. These are set in the Persona Admin → Metadata section.
- **Session flow**: Admin chat calls `POST /api/chat/tavus/session` with `persona_id`. The Audion API loads the persona, reads `tavus_replica_id`, and calls the Tavus API to create a conversation. The response (`conversation_url`, optional `meeting_token`) is returned and used to embed the CVI (iframe).
- **Security**: The Tavus API key is only used server-side (Audion API). The frontend never sees it; it only receives short-lived session data for the embed.

## Database migration

The Tavus columns (`tavus_replica_id`, `tavus_persona_id`) are added by Alembic migration `20260309_tavus`. You **must** run migrations before using the feature:

- **Docker/Coolify (API container):**  
  `docker exec -it <api-container> alembic -c apps/api/alembic.ini upgrade head`  
  (or from the app root inside the container: `alembic upgrade head`)

- **Local (from repo root):**  
  `cd apps/api && alembic upgrade head`

If you see `column personas.tavus_replica_id does not exist`, the migration has not been applied yet.

## Configuration

### Environment variables (API / Persona Backend)

| Variable         | Description                          | Required |
|------------------|--------------------------------------|----------|
| `TAVUS_API_KEY`  | Tavus API key (from Tavus dashboard) | Yes, for video |
| `TAVUS_API_BASE` | Tavus API base URL                   | No; default `https://tavusapi.com` |

If `TAVUS_API_KEY` is not set, the session endpoint returns 503 and the Video option in the UI will show an error when used.

### Persona metadata (Admin UI)

- **Tavus Replica ID**: Required for video. Copy from the Tavus dashboard (e.g. `rf4e9d9790f0`).
- **Tavus Persona ID**: Optional. Use if the replica is tied to a specific Tavus persona.

## Code references

- **Backend**: `apps/api/app/core/config.py` (settings), `apps/api/app/services/tavus_client.py` (create conversation), `apps/api/app/routers/personas.py` (`POST /api/persona-admin/tavus/session`).
- **Next.js proxy**: `apps/web/app/api/chat/tavus/session/route.ts` → forwards to Audion API.
- **Frontend**: `apps/web/components/tavus-video-panel.tsx` (iframe embed), `apps/web/app/admin/chat/page.tsx` (Video toggle, session request, conditional CVI display).

## Tavus documentation

- [Tavus API Reference](https://docs.tavus.io/api-reference) – Create Conversation, auth.
- [Embedding CVI](https://docs.tavus.io/sections/integrations/embedding-cvi) – iframe / React / Daily SDK options.

## Public chat

The **public** chat (share link) does **not** support Tavus in the current scope. Adding it would require a separate session flow for unauthenticated users (e.g. share token), quotas, and security rules.
