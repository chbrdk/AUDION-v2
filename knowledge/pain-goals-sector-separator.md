# Pain / goals — sector separator

- **Component**: `MsqdxGlassPainGoalsSectorSeparator` (`apps/web/components/generic/msqdx-glass-pain-goals-sector-separator.tsx`)
- **Placement**: Between `.msqdx-glass-pain-goals-stack__block.--pain` and `.--goal` in `msqdx-glass-pain-points-goals-card.tsx`
- **Geometry**: `MsqdxCornerBox` with cutdown on all four corners — `topLeft`/`topRight` `cutdown-b`, `bottomLeft`/`bottomRight` `cutdown-a` (`pain-goals-sector-separator-layout.ts`)
- **Radius / surface**: 24px (`CHIP_EDITOR_CORNER_BORDER_RADIUS_PX`), `--msqdx-pain-goals-corner-surface`
- **CSS**: `.msqdx-glass-pain-goals-sector-separator` — min-height via `--msqdx-pain-goals-sector-separator-height` in `dashboard-cards.css`
