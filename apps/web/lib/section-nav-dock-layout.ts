/** Matches `--msqdx-radius-3xl` — same radius as pain/goals corner-tab card body. */
export const SECTION_NAV_DOCK_BORDER_RADIUS_PX = 24;

/** Workspace dock shell beside subnav — outer frame radius (matches CSS on `--with-subnav`). */
export const SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX = 36;

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

/** Inner padding on `msqdx-glass-section-workspace__dock-shell` (px/py in section-shell). */
export const SECTION_WORKSPACE_DOCK_PADDING = "var(--msqdx-spacing-lg)";

/** Workspace panel beside subnav: all four corners rounded (no left-edge cutdown). */
export const SECTION_WORKSPACE_DOCK_CORNER_STYLES = {
  topLeft: "rounded",
  bottomLeft: "rounded",
  topRight: "rounded",
  bottomRight: "rounded",
} as const;
