# MsqdxCornerTabCard

BVik workflow nodes used `MsqdxCornerBox` as a top corner tab on React Flow cards. That pattern is now a design-system molecule.

## Source of truth

- Package: `@msqdx/react` (export `MsqdxCornerTabCard` — push `msqdx-design-system` to GitHub for Coolify)
- **AUDION deploy fallback:** `apps/web/lib/msqdx-corner-tab-card.tsx` (uses `MsqdxCornerBox` from `@msqdx/react`)
- DS path: `msqdx-design-system/packages/react/src/components/molecules/CornerTabCard/`
- Storybook: **Design System / Molecules / CornerTabCard**

## AUDION integration

**Standard shell (no slider):** `MsqdxCornerTabSection` in `@msqdx/react` — AUDION alias `MsqdxGlassCornerTabSection` — see `knowledge/msqdx-glass-corner-tab-section.md`.

Pain/Goals slider (`MsqdxGlassChipEditor` + `chipLayout="slider"`):

- Wrapper: `apps/web/components/generic/msqdx-glass-pain-goals-corner-shell.tsx`
- Tab icon/colors: `apps/web/lib/chip-editor-corner-tab.tsx`
- Controls row (title + AI/edit + chevrons) lives **inside** the corner-tab card body via `MsqdxGlassHorizontalCardSlider`.
- Pain Points: `cornerTabPlacement="top-left"` · Goals: `cornerTabPlacement="top-right"` (`msqdx-glass-pain-points-goals-card.tsx`).

## Usage

```tsx
import { MsqdxCornerTabCard } from "@msqdx/react";

<MsqdxCornerTabCard
  placement="top-left" // or "top-right"
  bodyColor="var(--color-theme-accent)"
  tab={<MsqdxIcon name="psychology" customSize={18} />}
  sx={{ p: 2, color: "#fff" }}
>
  Card content
</MsqdxCornerTabCard>
```

## Props

| Prop | Default | Notes |
|------|---------|--------|
| `placement` | `top-left` | `top-left` \| `top-right` |
| `tab` | — | Icon/label in corner tab |
| `bodyColor` | — | Main card fill |
| `tabChromeColor` | `#ffffff` | Outer tab chrome |
| `tabColor` | `bodyColor` | Inner tab fill |

Layout constants: `CORNER_TAB_CARD_DEFAULTS` (48×32 tab, +14px cutdown width — same as BVik `WF_NODE_CORNER_DECORATION`).

## Origin

- BVik: `apps/web/src/workflow/WorkflowBuilder.tsx`
- Atom: `MsqdxCornerBox` (`CornerDecoration/`)
