# MsqdxGlassCornerTabSection

AUDION glass wrapper around design-system **`MsqdxCornerTabSection`** (`@msqdx/react`).

## Source of truth

| Layer | Package / path |
|-------|----------------|
| **DS component** | `msqdx-design-system/packages/react/src/components/molecules/CornerTabSection/` |
| **Export** | `@msqdx/react` — `MsqdxCornerTabSection`, `MsqdxCornerTabSectionTab` |
| **AUDION alias** | `apps/web/components/msqdx/corner-tab/msqdx-glass-corner-tab-section.tsx` |
| **App CSS** | `apps/web/styles/msqdx-glass-corner-tab-section.css` (targets `.msqdx-glass-corner-tab-section` + `.msqdx-corner-tab-section`) |
| **Chip-editor adapter** | `apps/web/components/generic/msqdx-glass-pain-goals-corner-shell.tsx` (tab toolbar: actions only, no Material icon per variant) |

Storybook: **Design System / Molecules / CornerTabSection**

## Usage in AUDION

```tsx
import {
  MsqdxGlassCornerTabSection,
  MsqdxGlassCornerTabSectionTab,
} from "@/components/msqdx/corner-tab";
```

Or from DS directly:

```tsx
import { MsqdxCornerTabSection, MsqdxCornerTabSectionTab } from "@msqdx/react";
```

## Related

- `MsqdxCornerTabCard` — low-level card + tab (`@msqdx/react`)
- `knowledge/msqdx-corner-tab-card.md`
- Local re-export (deprecated): `apps/web/lib/msqdx-corner-tab-card.tsx`
