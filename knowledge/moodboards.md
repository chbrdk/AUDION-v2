# Moodboards

## Goal
Create an **editable** persona moodboard in the Admin persona detail view and show it **read-only** in the public share chat.

MVP:
- **Source**: Openverse only
- **Assets**: **hotlink** image URLs (no mirroring yet)
- **Attribution**: stored per tile (author/license/source URL)

## URLs & settings (centralized)

Backend settings live in `apps/api/app/core/config.py`:
- `openverse_api_base_url` (default `https://api.openverse.engineering`)
- `openverse_request_timeout_seconds`
- `openverse_user_agent`

Do not hardcode Openverse URLs outside settings.

## Data model

DB tables (schema `audion`):
- `persona_moodboards`
- `persona_moodboard_tiles`

Alembic migration:
- `apps/api/alembic/versions/20260416_persona_moodboards.py`

## Generation flow

1. Admin creates a moodboard via `POST /api/persona-admin/{persona_id}/moodboards`
2. API enqueues Celery task `moodboard.build` (queue `moodboards`)
3. Worker fetches Openverse images for default categories and writes tiles
4. Moodboard `status` transitions: `draft → building → ready|failed`

Implementation:
- Openverse client: `apps/api/app/services/openverse_client.py`
- Moodboard service: `apps/api/app/services/moodboard_service.py`
- Celery task: `apps/api/app/tasks/moodboard_tasks.py`

## API endpoints

### Admin (auth required)
- `GET /api/persona-admin/{persona_id}/moodboards/active`
- `POST /api/persona-admin/{persona_id}/moodboards` (creates + enqueues build)
- `POST /api/persona-admin/moodboards/{moodboard_id}/rebuild`
- `PATCH /api/persona-admin/moodboards/{moodboard_id}`
- `PATCH /api/persona-admin/moodboard-tiles/{tile_id}`
- `DELETE /api/persona-admin/moodboard-tiles/{tile_id}`

### Share (no auth; projectId acts as share token)
- `GET /personas/{persona_id}/moodboards/public?project_id=...`
- Web proxy: `apps/web/app/api/share/persona/[personaId]/moodboard/route.ts`

## Frontend integration

### Admin persona detail
- File: `apps/web/components/msqdx-glass-persona-admin-panel.tsx`
- Section: “Moodboard”
- Supports generate/rebuild, tile edit (caption/rationale/locked), delete

### Share chat
- File: `apps/web/app/chat/page.tsx`
- Displays a compact moodboard grid above the chat (if available)
- Loads via `GET /api/share/persona/{personaId}/moodboard?projectId=...`

## Attribution requirements

Each tile should keep:
- source page URL (`sourceUrl`)
- author (`author`)
- license (`license`)
- human-readable attribution (`attributionText`)

MVP UI shows attribution via `title` and tile dialog (admin).

## Future: mirroring assets

Hotlinking is fragile (dead links, ToS, CORS, tracking). The next step is to mirror external images into our storage:
- store `storage_key` + generated thumbnails
- keep the original attribution metadata unchanged

