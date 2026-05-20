# Pain / goals — sector separator

- **Component**: `MsqdxGlassPainGoalsSectorSeparator` (`apps/web/components/generic/msqdx-glass-pain-goals-sector-separator.tsx`)
- **Placement**: Between `.msqdx-glass-pain-goals-stack__block.--pain` and `.--goal` in `msqdx-glass-pain-points-goals-card.tsx`
- **Line**: 1px horizontal rule (`.msqdx-glass-pain-goals-sector-separator__line`)
- **Color**: `--msqdx-section-workspace-frame-border` (same as `.msqdx-glass-section-workspace--with-subnav` frame; light = black)
- **Corners**: Four 24×24px `MsqdxCornerBox` patches at TL/TR/BL/BR, same frame color (`pain-goals-sector-separator-layout.ts`)
- **Bleed**: Inside `.msqdx-glass-section-workspace__dock-shell`, negative `margin-inline` cancels `--msqdx-section-workspace-dock-padding` (`--msqdx-spacing-lg`)
