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
| `--msqdx-pain-goals-corner-surface` | Corner-tab shell + `.msqdx-corner-tab-card__body` (light: `neutral-05`) |
| `--msqdx-pain-goals-slide-surface` | Pain/goal slide cards only (light: `neutral-02`) |
| `--msqdx-pain-goals-index-surface` | Reserved alias of corner surface (not applied on `.msqdx-glass-pain-goals-slide-card__index-corner`) |
| `--msqdx-pain-goals-slide-surface-pain` / `-goal` | Alias → `--msqdx-pain-goals-slide-surface` |
| `--msqdx-pain-goals-slide-border-default` | (unused while slides are borderless) |
| `--msqdx-pain-goals-scrollbar-thumb` | Horizontal scrollbar |

Pain/goal slide cards have **no border**. Index `MsqdxCornerBox` is transparent; container color comes from the shell behind the slide notch (`clip-path` on `__body--indexed`).

Styles: `apps/web/styles/dashboard-cards.css` (`.msqdx-glass-pain-goals-*`).

## Related

- `knowledge/pain-goals-slide-index-corner.md` — index cutout badge on slides  
- Dark brand tints in `globals.css` `[data-theme="dark"]` are **solid** (no `rgba` on DX tints)
