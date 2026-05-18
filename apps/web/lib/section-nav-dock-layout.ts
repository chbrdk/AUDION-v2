/** Matches `--msqdx-radius-3xl` — same radius as pain/goals corner-tab card body. */
export const SECTION_NAV_DOCK_BORDER_RADIUS_PX = 24;

export const SECTION_NAV_DOCK_SURFACE =
  "var(--msqdx-section-nav-dock-surface, var(--color-primary-white, #ffffff))";

/**
 * Left rail docked to workspace on the right: outer corners rounded on the left,
 * cutdown-b on the right (patch on the right edge → reads as oben/unten rechts, not rechts oben/unten).
 */
export const SECTION_NAV_DOCK_CORNER_STYLES = {
  topLeft: "rounded",
  bottomLeft: "rounded",
  topRight: "cutdown-b",
  bottomRight: "cutdown-b",
} as const;
