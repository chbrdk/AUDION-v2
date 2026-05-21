# Persona v2 section pages — chip stack layout (Pain & Goals, Personality)

Reference for redesigning persona admin **v2 section routes** (`presentation="v2-section"`, `embedInSection`).

## Pattern (shared)

1. **No nested accordion cards** in v2 — section shell already shows title; pass `embedInSection={isV2Section}` from `msqdx-glass-persona-admin-panel.tsx`.
2. **Vertical stack** — `msqdx-glass-*-stack` with `__block` articles per sector.
3. **Sector separators** — reuse `MsqdxGlassPainGoalsSectorSeparator` (1px frame line + cutdown-b corner brackets, full-bleed in workspace dock).
4. **Horizontal chip sliders** — `MsqdxGlassChipEditor` with `chipLayout="slider"`, `slidesVisible={3.5}`, `relaxedSpacing`, `cornerTabPlacement="top-right"`.
5. **Corner-tab chrome** — `MsqdxGlassPainGoalsCornerShell` + indexed slide cards when `resolveChipEditorCornerTabStyle(variant)` returns a style (see `lib/chip-editor-corner-tab.tsx`).
6. **Tokens** — slide/corner surfaces: `--msqdx-pain-goals-corner-surface`, `--msqdx-pain-goals-slide-surface` (shared naming; personality reuses same chrome).

## Pain & Goals (`pain-goals`)

| Block | Modifier | Chip class | Corner tab icon |
|-------|----------|------------|-----------------|
| Pain points | `--pain` | `--pain` | `sentiment_dissatisfied` (pink) |
| Goals | `--goal` | `--goal` | `flag` (blue) |

**Files:** `components/dashboard-cards/msqdx-glass-pain-points-goals-card.tsx`, `styles/dashboard-cards.css` (`.msqdx-glass-pain-goals-stack__block`), tests: `lib/persona-pain-goals-layout.test.ts`.

## Personality (`personality`)

| Block | Modifier | Chip class | Corner tab icon |
|-------|----------|------------|-----------------|
| Traits | `--trait` | `--trait` | `psychology` (green) |
| Interests | `--interest` | `--interest` | `lightbulb` (yellow) |
| Values + social | `--value` | `--value`, `--social` | `volunteer_activism`, `share` (green / orange) |

**Files:** `components/dashboard-cards/msqdx-glass-personality-card.tsx`, `.msqdx-glass-personality-stack__block`, tests: `lib/persona-personality-layout.test.ts`.

## v1 fallback

When `embedInSection` is false, keep legacy `MsqdxDashboardCard` accordions but each card body uses the same slider blocks (no stack separators between cards).
