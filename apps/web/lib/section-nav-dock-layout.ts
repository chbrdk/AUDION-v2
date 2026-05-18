/** Matches `--msqdx-radius-3xl` — same radius as pain/goals corner-tab card body. */
export const SECTION_NAV_DOCK_BORDER_RADIUS_PX = 24;

/** Subtle rail fill — see `--msqdx-section-nav-dock-surface` in section-shell.css */
export const SECTION_NAV_DOCK_SURFACE = "var(--msqdx-section-nav-dock-surface)";

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

/**
 * Right-hand workspace docked to the subnav on the left: outer corners rounded on the right,
 * cutdown on the left edge for a seamless seam with the nav rail.
 */
export const SECTION_WORKSPACE_DOCK_CORNER_STYLES = {
  topLeft: "cutdown-b",
  bottomLeft: "cutdown-b",
  topRight: "rounded",
  bottomRight: "rounded",
} as const;
