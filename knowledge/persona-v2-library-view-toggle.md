# Persona v2 library — card / list view

## UI

- Route: `/admin/personas-v2` → `MsqdxGlassPersonasV2Overview`
- Header: scope + title only (no preview subtitle/description/banner)
- Toggle: `PersonasOverviewLayoutToggle` in section `workspaceActions` (grid / list icons)
- Rendering: `MsqdxGlassPersonasOverview` with `layout="cards" | "list"`

## Persistence

- Key: `audion-personas-overview-view` (`PERSONAS_OVERVIEW_VIEW_MODE_STORAGE_KEY` in `apps/web/lib/personas-overview-view-mode.ts`)
- Values: `cards` (default), `list`

## Key tags (library preview)

- Helper: `apps/web/lib/persona-list-key-tags.ts` — up to 3 tags from traits → interests → values → goals → pains
- Source: `profile` on list items (falls back to `profileCard`)
- UI: `MsqdxGlassPersonaChip` in card/list rows (replaces confidence %)

## i18n

- `personaV2.library.viewCards`, `viewList`, `layoutToggleLabel`
