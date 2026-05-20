# Pain / goals slider — index cutout (`MsqdxCornerBox`)

- **Geometry**: Same pattern as the black entity hero: **`topLeft="cutdown-a"`** and **`bottomRight="cutdown-b"`** (other corners `rounded`) so the **cutdown patches** from `@msqdx/react` read as a real cutout tab, not a plain rounded pill.
- **Radius**: `PAIN_GOALS_SLIDE_INDEX_BADGE_RADIUS_PX` in `apps/web/lib/chip-editor-corner-tab.tsx` (22px — large enough for the mask to read; slide card frame stays 18px).
- **Clipping**: The slide **shell** (`.msqdx-glass-pain-goals-slide-card`) uses **`overflow: visible`**. Long text scrolls in **`.msqdx-glass-pain-goals-slide-card__body`** (`overflow-y: auto`). Previously a single node had `overflow-y: auto`, which **clipped** the cutout patches.
- **Viewport gutter**: `.msqdx-glass-chip-editor__corner-tab-shell .msqdx-glass-horizontal-card-slider__viewport` gets **`padding-inline: max(24px, …)`** so patches that extend horizontally past the badge are not clipped by **`overflow-x: auto`** on the viewport.
- **Slides**: `.msqdx-glass-horizontal-card-slider__slide` sets **`overflow: visible`**.
- **Surface**: Badge uses `var(--msqdx-pain-goals-slide-surface)` from CSS (`.msqdx-glass-pain-goals-slide-card__index-corner`), same as the slide card.
- **i18n**: `chipEditor.slideIndexAria` (`{n}`) on the corner box `aria-label`.
- **Body padding**: `.msqdx-glass-pain-goals-slide-card__body--indexed` adds left padding so copy clears the badge.
