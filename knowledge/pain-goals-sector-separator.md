# Pain / goals — sector separator

- **Component**: `MsqdxGlassPainGoalsSectorSeparator` (`apps/web/components/generic/msqdx-glass-pain-goals-sector-separator.tsx`)
- **Placement**: Between `.msqdx-glass-pain-goals-stack__block.--pain` and `.--goal` in `msqdx-glass-pain-points-goals-card.tsx`
- **Line**: 1px horizontal rule; root `.msqdx-glass-pain-goals-sector-separator` is `height: 1px` (corners overflow via `overflow: visible`)
- **Color**: `--msqdx-section-workspace-frame-border` (same as `.msqdx-glass-section-workspace--with-subnav` frame; light = black)
- **Corners**: Four CSS `span` anchors + `::before` cutdown-b patches (same geometry as `MsqdxCornerBox` `CUTDOWN_DEFS`); top extends up (`(_`), bottom extends down (`(`); `z-index: 1` on separator
- **Bleed**: Only direct separators under `.msqdx-glass-pain-goals-stack` (pain/goals) or `.msqdx-glass-personality-stack` inside `.msqdx-glass-section-workspace__dock-shell`; negative `margin-inline` cancels `--msqdx-section-workspace-dock-padding`
- **Contained**: Separators in `.msqdx-glass-persona-basics-stack` / `.msqdx-glass-bio-stack` use `width: 100%`, no dock bleed (persona v2 basics)
