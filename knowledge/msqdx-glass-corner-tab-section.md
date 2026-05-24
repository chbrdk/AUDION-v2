# MsqdxGlassCornerTabSection

Standardized AUDION shell: **cutout corner tab + card body**, no slider.

## Location

| Item | Path |
|------|------|
| Section shell | `apps/web/components/msqdx/corner-tab/msqdx-glass-corner-tab-section.tsx` |
| Tab toolbar row | `apps/web/components/msqdx/corner-tab/msqdx-glass-corner-tab-section-tab.tsx` |
| Barrel | `apps/web/components/msqdx/corner-tab/index.ts` → `components/msqdx/index.ts` |
| Constants | `apps/web/lib/msqdx-corner-tab-section.ts` |
| CSS | `apps/web/styles/msqdx-glass-corner-tab-section.css` |
| Chip-editor adapter | `apps/web/components/generic/msqdx-glass-pain-goals-corner-shell.tsx` |

## Usage (standalone, no slider)

```tsx
import {
  MsqdxGlassCornerTabSection,
  MsqdxGlassCornerTabSectionTab,
} from "@/components/msqdx/corner-tab";
import { MsqdxIcon } from "@msqdx/react";

<MsqdxGlassCornerTabSection
  placement="top-right"
  tabAriaLabel="Pain points"
  tabToolbar
  tab={
    <MsqdxGlassCornerTabSectionTab
      heading={<h3>Pain Points (12)</h3>}
    >
      <MsqdxIcon name="sentiment_dissatisfied" customSize={18} />
    </MsqdxGlassCornerTabSectionTab>
  }
>
  {/* Any body content — lists, forms, static text */}
</MsqdxGlassCornerTabSection>
```

## Props

### `MsqdxGlassCornerTabSection`

| Prop | Default | Notes |
|------|---------|--------|
| `tab` | — | Corner tab content (icon or `MsqdxGlassCornerTabSectionTab`) |
| `tabAriaLabel` | — | Required a11y label |
| `placement` | `top-right` | `top-left` \| `top-right` |
| `tabToolbar` | `false` | Auto-width tab + toolbar spacing |

### `MsqdxGlassCornerTabSectionTab`

| Prop | Notes |
|------|--------|
| `heading` | Title inside tab |
| `children` | Actions row (icons, buttons) |

## What it wraps

- `MsqdxCornerTabCard` (`apps/web/lib/msqdx-corner-tab-card.tsx`) — local DS mirror with `tabWidthAuto`
- `MsqdxCornerBox` from `@msqdx/react` — cutdown geometry

## What it excludes

- Horizontal slider / scroll viewport
- Chip editor, indexed pain/goals slides, AI/edit controls

Pain/goals slider still uses this shell via `MsqdxGlassPainGoalsCornerShell`, which adds variant icon + chip-editor toolbar inside the tab.
