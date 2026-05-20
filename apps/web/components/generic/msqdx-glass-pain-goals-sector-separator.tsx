"use client";

import { MsqdxCornerBox } from "@msqdx/react";
import {
  PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX,
  PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES,
  PAIN_GOALS_SECTOR_SEPARATOR_SURFACE,
} from "../../lib/pain-goals-sector-separator-layout";

/**
 * Visual gutter between pain-points and goals stacks — `MsqdxCornerBox` with
 * cutdown geometry on all four corners (sector separator).
 */
export function MsqdxGlassPainGoalsSectorSeparator() {
  const { topLeft, topRight, bottomLeft, bottomRight } = PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES;

  return (
    <MsqdxCornerBox
      component="div"
      role="separator"
      aria-orientation="horizontal"
      className="msqdx-glass-pain-goals-sector-separator"
      topLeft={topLeft}
      topRight={topRight}
      bottomLeft={bottomLeft}
      bottomRight={bottomRight}
      borderRadius={PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX}
      sx={{
        width: "100%",
        boxSizing: "border-box",
        bgcolor: PAIN_GOALS_SECTOR_SEPARATOR_SURFACE,
        border: "none",
        flexShrink: 0,
      }}
    />
  );
}
