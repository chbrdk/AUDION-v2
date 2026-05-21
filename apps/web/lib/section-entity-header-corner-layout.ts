import { SECTION_NAV_HORIZONTAL_MEDIA_QUERY } from "./section-nav-dock-layout";

export { SECTION_NAV_HORIZONTAL_MEDIA_QUERY as SECTION_ENTITY_CORNER_ACCENT_RESPONSIVE_MEDIA_QUERY };

/** Desktop: accent hooks into workspace frame (cutdown on inner edges). */
export const SECTION_ENTITY_CORNER_ACCENT_CORNERS_DESKTOP = {
  topLeft: "cutdown-a",
  topRight: "rounded",
  bottomLeft: "rounded",
  bottomRight: "cutdown-b",
} as const;

/** ≤1024px stacked above horizontal subnav: full 36px radius on all corners. */
export const SECTION_ENTITY_CORNER_ACCENT_CORNERS_RESPONSIVE = {
  topLeft: "rounded",
  topRight: "rounded",
  bottomLeft: "rounded",
  bottomRight: "rounded",
} as const;
