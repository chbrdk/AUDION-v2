import { CHIP_EDITOR_CORNER_BORDER_RADIUS_PX } from "./chip-editor-corner-tab";

/** Matches pain/goals corner-tab shell surface (light/dark via CSS variables). */
export const PAIN_GOALS_SECTOR_SEPARATOR_SURFACE =
  "var(--msqdx-pain-goals-corner-surface, var(--audion-neutral-05, #e0e0e0))";

/** Same radius as corner-tab card body / tab chrome. */
export const PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX = CHIP_EDITOR_CORNER_BORDER_RADIUS_PX;

/**
 * Horizontal sector gutter between pain and goals:
 * cutdown on all four corners (inward scoops at TL/TR/BL/BR).
 */
export const PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES = {
  topLeft: "cutdown-b",
  topRight: "cutdown-b",
  bottomLeft: "cutdown-a",
  bottomRight: "cutdown-a",
} as const;
