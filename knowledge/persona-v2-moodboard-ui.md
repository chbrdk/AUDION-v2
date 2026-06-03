# Persona v2 — Moodboard UI

## Component

- `apps/web/components/personas-v2/msqdx-glass-persona-moodboard-section.tsx`
- Used when `presentation === "v2-section"` and section `moodboard` (via `MsqdxGlassPersonaAdminPanel`).

## Design intent

- **Atmosphere header** — gradient, glow orbs, persona headline + style keywords (not a status-only toolbar).
- **Mosaic grid** — existing bento layout (`moodboardTileGridSx`, max 3 columns); immersive row heights.
- **Per-category color** — `moodboardCategoryVisual()` drives border glow and tinted overlays (lifestyle, colors, textures, people, ui, typography).
- **Copy on image** — mood line + category + optional caption; no duplicate footer bar under each tile.
- **Hover actions** — edit/delete fade in on tile hover.
- **Empty state** — animated placeholder grid + CTA copy.

## Styles

- `apps/web/styles/dashboard-cards.css` — `.msqdx-glass-moodboard-*`

## i18n

- `personaV2.moodboard.*` in `apps/web/locales/de.json` and `en.json`

## Tests

- `apps/web/lib/moodboard-tile-ui.test.ts` (category visual + immersive grid)
