# Pain / goals — sector separator

- **Component**: `MsqdxGlassPainGoalsSectorSeparator` (`apps/web/components/generic/msqdx-glass-pain-goals-sector-separator.tsx`)
- **Placement**: Between `.msqdx-glass-pain-goals-stack__block.--pain` and `.--goal` in `msqdx-glass-pain-points-goals-card.tsx`
- **Line**: 1px horizontal rule; root `.msqdx-glass-pain-goals-sector-separator` is `height: 1px` (corners overflow via `overflow: visible`)
- **Color**: `--msqdx-section-workspace-frame-border` (same as `.msqdx-glass-section-workspace--with-subnav` frame; light = black)
- **Corners**: Four 24×24px `MsqdxCornerBox` shells (transparent); frame color only on cutdown `aria-hidden` patches (`dashboard-cards.css`)
- **Bleed**: Inside `.msqdx-glass-section-workspace__dock-shell`, negative `margin-inline` cancels `--msqdx-section-workspace-dock-padding` (`--msqdx-spacing-lg`)
