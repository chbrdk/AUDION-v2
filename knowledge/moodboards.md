# Moodboards

## Goal
Create an **editable** persona moodboard in the Admin persona detail view and show it **read-only** in the public share chat.

MVP:
- **Sources**:
  - **Openverse** (default stock search; hotlink)
  - optional **Pexels** fallback (requires `PEXELS_API_KEY`)
  - optional **OpenAI Images** generation (stores PNGs in `DATA_DIR`; controlled by `MOODBOARD_IMAGE_SOURCE`)
- **Assets**:
  - Openverse/Pexels: **hotlink** remote URLs (MVP)
  - OpenAI: store PNGs on disk under `DATA_DIR` and serve via same-origin proxy routes
- **Attribution**: stored per tile (author/license/source URL)

## URLs & settings (centralized)

Backend settings live in `apps/api/app/core/config.py`:
- `openverse_api_base_url` (default `https://api.openverse.org`; older `https://api.openverse.engineering` redirects with **301**)
- `openverse_request_timeout_seconds`
- `openverse_user_agent`
- `pexels_api_base_url` (default `https://api.pexels.com`)
- `pexels_request_timeout_seconds`
- `pexels_user_agent`
- `pexels_api_key` (**optional**; enables Pexels fallback when Openverse returns no usable images)
- `moodboard_image_source` (`openverse` | `openai` | `auto`, default **`auto`**)
  - In `auto`, the worker uses **OpenAI** when `OPENAI_API_KEY` is set, otherwise **Openverse**
- `moodboard_openai_model` (default `gpt-image-1-mini`)
- `moodboard_openai_quality` (default `low`)
- `moodboard_openai_size` (default `1024x1024`)
- `moodboard_openai_image_count` (default `8`, clamped to `1..10` in service)
- `openai_api_base_url`, `openai_api_key`, `openai_image_docs_url`

Do not hardcode Openverse URLs outside settings.

### Openverse auth / limits (operational note)

Openverse supports **anonymous** access, but requests are **rate limited**. For higher limits you register an OAuth application and send `Authorization: Bearer …` (see Openverse docs: `https://api.openverse.org/v1/#section/Register-and-Authenticate`).

### Query quality (why builds can “fail” with HTTP 200)

Openverse can return `200` with `results=[]` (or results that do not normalize into usable `image_url`s) when the query is too long / too “narrative”.

The moodboard builder mitigates this by:
- splitting persona text on commas/colons/bullets into shorter phrases
- keeping per-category queries short
- retrying each category with a broad English fallback query if the first attempt returns no images

### Serving generated/stored tile images (OpenAI path)

When tiles store a filesystem **storage key** (not `https://...`), the API returns **same-origin** URLs:

- Share (public): `/api/share/persona/{personaId}/moodboard-tile/{tileId}?projectId=...` → proxies to backend `GET /personas/{personaId}/moodboard-tiles/{tileId}/image?project_id=...`
- Admin (auth): `/api/persona-admin/moodboard-tiles/{tileId}/image` → proxies to backend `GET /api/persona-admin/moodboard-tiles/{tileId}/image`

### OpenAI operational notes

OpenAI’s GPT Image models may require **organization verification** depending on account status (see OpenAI docs: `https://developers.openai.com/api/docs/guides/image-generation?api=image`).

Implementation note (API request shape):
- `response_format` is for **DALL·E** models. **GPT Image models ignore/reject it**; they return `data[].b64_json` by default (see OpenAI API reference for image generation).

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
- Persona drawer (“Persona overview”) includes a **strip** (`apps/web/components/moodboard-persona-drawer-strip.tsx`): up to **4** thumbnails + hint text; strings under `chat.moodboard*` in `apps/web/locales/*.json`.

### Tile overlay copy & layout (centralized)
- File: `apps/web/lib/moodboard-tile-ui.ts`
- Image overlay **primary line** is **category-specific** (locale `de` / `en`), not the persona headline (headline stays in persona context).
- Grid is **max 3 columns** from `sm` up (`repeat(3, 1fr)`), **2 columns** on `xs`, so tiles stay large enough to read. **8-tile** boards use a **3-column bento** (hero + sidebar + rows); other counts use a **2×2 hero** in the first cell + single-column tiles.

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

