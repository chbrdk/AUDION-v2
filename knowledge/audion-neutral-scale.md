# Audion neutral scale (solid greys)

## Source of truth

| Asset | Role |
|-------|------|
| `apps/web/styles/audion-neutral-scale.css` | CSS vars: 20 steps + semantic aliases + pain/goals tokens |
| `apps/web/lib/audion-neutral-scale.ts` | Step count, hex ramp, token list for tests |

Imported in `apps/web/app/layout.tsx` **before** `globals.css`.

## Steps

`--audion-neutral-00` … `--audion-neutral-19` — **20 solid hex values**, no alpha.

- **00** = white, **19** = black  
- Warm ramp (aligned with page neutral ~`#f3f2ed` at step 03)

## Semantic aliases (use these in components)

| Token | Light (typical) | Dark (typical) |
|-------|-----------------|----------------|
| `--color-text-primary` | 19 | 00 |
| `--color-text-secondary` | 11 | 08 |
| `--color-background-primary` | 00 | 16 |
| `--color-border-subtle` | 06 | 13 |

## Pain / goals slider

| Token | Purpose |
|-------|---------|
| `--msqdx-pain-goals-corner-surface` | Corner-tab shell + card body |
| `--msqdx-pain-goals-slide-surface-default` | Neutral slide fill |
| `--msqdx-pain-goals-slide-border-default` | Neutral slide border |
| `--msqdx-pain-goals-scrollbar-thumb` | Horizontal scrollbar |
| `--msqdx-pain-goals-slide-surface-pain` / `-border-pain` | Pain slides |
| `--msqdx-pain-goals-slide-surface-goal` / `-border-goal` | Goal slides |

Styles: `apps/web/styles/dashboard-cards.css` (`.msqdx-glass-pain-goals-*`).

## Related

- `knowledge/pain-goals-slide-index-corner.md` — index cutout badge on slides  
- Dark brand tints in `globals.css` `[data-theme="dark"]` are **solid** (no `rgba` on DX tints)
