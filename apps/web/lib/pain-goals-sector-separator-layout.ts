import { CHIP_EDITOR_CORNER_BORDER_RADIUS_PX } from "./chip-editor-corner-tab";
import { SECTION_WORKSPACE_DOCK_PADDING } from "./section-nav-dock-layout";

/** Negative bleed cancels dock-shell horizontal padding so the line spans edge-to-edge. */
export const PAIN_GOALS_SECTOR_SEPARATOR_BLEED_PADDING = SECTION_WORKSPACE_DOCK_PADDING;

/** Same stroke as `.msqdx-glass-section-workspace--with-subnav` frame (light = black). */
export const PAIN_GOALS_SECTOR_SEPARATOR_COLOR =
  "var(--msqdx-section-workspace-frame-border, var(--color-theme-accent, #000000))";

export const PAIN_GOALS_SECTOR_SEPARATOR_LINE_HEIGHT_PX = 1;

/** Corner patch size (matches cutdown radius on the separator brackets). */
export const PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX = CHIP_EDITOR_CORNER_BORDER_RADIUS_PX;

/**
 * Bracket geometry around the 1px line: `(_` above, `(` below (per side).
 * Top corners: cutdown-b (patch extends up). Bottom corners: cutdown-b (patch extends down).
 */
export const PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES = {
  topLeft: { topLeft: "cutdown-b", topRight: "square", bottomLeft: "square", bottomRight: "square" },
  topRight: { topLeft: "square", topRight: "cutdown-b", bottomLeft: "square", bottomRight: "square" },
  bottomLeft: { topLeft: "square", topRight: "square", bottomLeft: "cutdown-b", bottomRight: "square" },
  bottomRight: { topLeft: "square", topRight: "square", bottomLeft: "square", bottomRight: "cutdown-b" },
} as const;
