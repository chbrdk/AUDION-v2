# Pain / goals slider — index cutout (`MsqdxCornerBox`)

- **Geometry**: **`topLeft="square"`**, **`topRight="cutdown-a"`**, **`bottomLeft="cutdown-b"`**, **`bottomRight="rounded"`** on `MsqdxCornerBox` in `msqdx-glass-chip-editor.tsx`.
- **Radius**: `PAIN_GOALS_SLIDE_INDEX_BADGE_RADIUS_PX` in `apps/web/lib/chip-editor-corner-tab.tsx` (22px — large enough for the mask to read; slide card frame stays 18px).
- **Text wrap**: Index `MsqdxCornerBox` sits **inside** `.msqdx-glass-pain-goals-slide-card__body--indexed` as the first child; CSS **`float: left`** + **`shape-outside: margin-box`** so copy flows around the badge (no `clip-path` notch).
- **Viewport gutter**: `.msqdx-glass-chip-editor__corner-tab-shell .msqdx-glass-horizontal-card-slider__viewport` gets **`padding-inline: max(24px, …)`** so patches that extend horizontally past the badge are not clipped by **`overflow-x: auto`** on the viewport.
- **Slides**: `.msqdx-glass-horizontal-card-slider__slide` sets **`overflow: visible`**.
- **Surface**: `.msqdx-glass-pain-goals-slide-card__index-corner` is **transparent** (no `background-color`). The container shade shows through the clipped notch on the slide body; do not set index-surface on this class.
- **i18n**: `chipEditor.slideIndexAria` (`{n}`) on the corner box `aria-label`.
- **Body padding**: `.msqdx-glass-pain-goals-slide-card__body--indexed` adds left padding so copy clears the badge.
