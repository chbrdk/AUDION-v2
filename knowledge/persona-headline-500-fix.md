# Persona 500 — headline too long (VARCHAR 256)

## Problem
- **Create**: `Failed to generate target group persona: 500 - StringDataRightTruncation: value too long for type character varying(256)` when creating a persona. The `headline` is filled from `payload.description` (or AI output) and can exceed 256 characters.
- **Update (PATCH)**: `PATCH /api/persona-admin/:id` (proxied to `PATCH /personas/:id`) can return 500 for the same reason when saving a persona with a long headline.

## Fix (2026-03-09)
- **Model**: `audion.personas.headline` changed from `String(256)` to `Text` in `apps/api/app/models/__init__.py`.
- **Migration**: `20260309_personas_headline_text` alters the column to `TEXT` in the database.
- **Router**: `update_persona` in `apps/api/app/routers/personas.py` now catches exceptions and returns 500 with a readable `detail` (including a hint to run the headline migration if the error is truncation). Prompt parsing is also safe (camelCase/snake_case, parse errors no longer cause 500).

## Apply
From the API app root (e.g. `apps/api`):
```bash
alembic upgrade head
```

**Important:** Run this on the deployment server (e.g. `audion.projects-a.plygrnd.tech`) as well; otherwise PATCH save will keep failing with truncation.

## References
- Model: `Persona.headline` in `apps/api/app/models/__init__.py`
- Migration: `apps/api/alembic/versions/20260309_personas_headline_text.py`
- Router: `generate_target_group_persona` in `apps/api/app/routers/target_groups.py` (uses `payload.description` as initial headline)
- Update: `update_persona` in `apps/api/app/routers/personas.py` (PATCH /personas/:id); frontend calls via Next.js proxy at `/api/persona-admin/:id`
