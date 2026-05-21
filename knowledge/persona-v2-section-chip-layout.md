# Persona v2 section pages — layout guide

Reference for persona admin **v2 section routes** (`presentation="v2-section"`, `embedInSection`).

## Universal v2 shell (every chip section)

Use on **all** v2 sections that today use nested `MsqdxDashboardCard` accordions:

1. **`embedInSection={isV2Section}`** — section nav/shell owns the title; no inner accordion chrome.
2. **Vertical stack** — `msqdx-glass-*-stack` + `__block` per logical group.
3. **Sector separators** — `MsqdxGlassPainGoalsSectorSeparator` between blocks (frame line + cutdown corners).

Sliders are **not** part of this shell.

## Chip layout per section (pick one)

| Layout | When to use | Examples |
|--------|-------------|----------|
| **`slider`** | Few narrative “cards”, user scans horizontally, corner-tab + index badge | Pain points, goals |
| **`list`** | Long text per item, one row each, vertical scan | Long-form bullet lists |
| **`inline`** | Short tags, dense wrap (default for many chips) | Personality (traits, interests, values, social) |
| **Custom** | Not chip-based | Bio form, moodboard grid, knowledge table |

Rule: **default to `inline`** for tag-like chips; use **`list`** only when each entry needs a full row. Use **`slider` only for card-carousel UX** (currently: pain-goals only).

## Implemented sections

### Pain & Goals (`pain-goals`)

- Stack + separators + **`chipLayout="slider"`** (3.5 visible, corner-tab chrome).
- Files: `msqdx-glass-pain-points-goals-card.tsx`, `lib/persona-pain-goals-layout.test.ts`.

### Personality (`personality`)

- Stack + separators + **`chipLayout="inline"`** (wrapping tags, compact).
- Values block: two list editors (values, then social) in one `__block`.
- Files: `msqdx-glass-personality-card.tsx`, `lib/persona-personality-layout.test.ts`.

## v1 fallback

When `embedInSection` is false, keep legacy `MsqdxDashboardCard` accordions; block bodies use the same chip layout as v2.

## Adding a new v2 section

1. Add `embedInSection` on the section card in `msqdx-glass-persona-admin-panel.tsx`.
2. Choose layout from the table above (avoid copying slider unless justified).
3. If multiple groups: stack + separator, not multiple accordions.
