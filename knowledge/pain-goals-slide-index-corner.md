# Pain / goals slider — index corner badge

- **UI**: Pain- and goal-chips in **slider** layout with corner tab chrome (`MsqdxGlassPainGoalsCornerShell`) show a top-left **`MsqdxCornerBox`** cutout (`topLeft="cutdown-a"`) with the **1-based entry index**.
- **Surface**: Badge `bgcolor` uses CSS var **`--msqdx-pain-goals-slide-surface`**, defined on `.msqdx-glass-pain-goals-slide-card` (same token as the card background) in `apps/web/styles/dashboard-cards.css`.
- **Radius constant**: `PAIN_GOALS_SLIDE_INDEX_BADGE_RADIUS_PX` (18) in `apps/web/lib/chip-editor-corner-tab.tsx` — matches slide card `border-radius: 18px`.
- **i18n**: `chipEditor.slideIndexAria` (`{n}`) — `aria-label` on the corner box for screen readers.
- **Spacing**: Modifier **`msqdx-glass-pain-goals-slide-card--indexed`** adds left padding so body text clears the badge.
