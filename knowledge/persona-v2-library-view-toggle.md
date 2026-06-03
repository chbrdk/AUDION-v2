# Persona v2 library — card / list view

## UI

- Route: `/admin/personas-v2` → `MsqdxGlassPersonasV2Overview`
- Toggle: `PersonasOverviewLayoutToggle` in section `workspaceActions` (grid / list icons)
- Rendering: `MsqdxGlassPersonasOverview` with `layout="cards" | "list"`

## Persistence

- Key: `audion-personas-overview-view` (`PERSONAS_OVERVIEW_VIEW_MODE_STORAGE_KEY` in `apps/web/lib/personas-overview-view-mode.ts`)
- Values: `cards` (default), `list`

## i18n

- `personaV2.library.viewCards`, `viewList`, `layoutToggleLabel`
