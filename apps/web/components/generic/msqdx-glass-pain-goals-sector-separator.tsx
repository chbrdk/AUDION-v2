"use client";

import { Box } from "@mui/material";
import { MsqdxCornerBox } from "@msqdx/react";
import {
  PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX,
  PAIN_GOALS_SECTOR_SEPARATOR_COLOR,
  PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES,
  PAIN_GOALS_SECTOR_SEPARATOR_LINE_HEIGHT_PX,
} from "../../lib/pain-goals-sector-separator-layout";

/** Shell is transparent; frame color is applied to MsqdxCornerBox cutdown patches via CSS. */
const cornerSx = {
  position: "absolute" as const,
  width: PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX,
  height: PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX,
  minWidth: PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX,
  minHeight: PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX,
  boxSizing: "border-box" as const,
  bgcolor: "transparent",
  border: "none",
  overflow: "visible" as const,
  pointerEvents: "none" as const,
};

/**
 * 1px sector line between pain and goals with frame-colored corner brackets
 * (same token as section workspace border).
 */
export function MsqdxGlassPainGoalsSectorSeparator() {
  const r = PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX;

  return (
    <Box
      component="div"
      role="separator"
      aria-orientation="horizontal"
      className="msqdx-glass-pain-goals-sector-separator"
    >
      <MsqdxCornerBox
        className="msqdx-glass-pain-goals-sector-separator__corner msqdx-glass-pain-goals-sector-separator__corner--top-left"
        borderRadius={r}
        sx={{ ...cornerSx, top: 0, left: 0 }}
        {...PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES.topLeft}
      />
      <MsqdxCornerBox
        className="msqdx-glass-pain-goals-sector-separator__corner msqdx-glass-pain-goals-sector-separator__corner--top-right"
        borderRadius={r}
        sx={{ ...cornerSx, top: 0, right: 0 }}
        {...PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES.topRight}
      />
      <MsqdxCornerBox
        className="msqdx-glass-pain-goals-sector-separator__corner msqdx-glass-pain-goals-sector-separator__corner--bottom-left"
        borderRadius={r}
        sx={{ ...cornerSx, bottom: 0, left: 0 }}
        {...PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES.bottomLeft}
      />
      <MsqdxCornerBox
        className="msqdx-glass-pain-goals-sector-separator__corner msqdx-glass-pain-goals-sector-separator__corner--bottom-right"
        borderRadius={r}
        sx={{ ...cornerSx, bottom: 0, right: 0 }}
        {...PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES.bottomRight}
      />
      <Box
        component="span"
        className="msqdx-glass-pain-goals-sector-separator__line"
        aria-hidden
        sx={{
          display: "block",
          height: PAIN_GOALS_SECTOR_SEPARATOR_LINE_HEIGHT_PX,
          bgcolor: PAIN_GOALS_SECTOR_SEPARATOR_COLOR,
        }}
      />
    </Box>
  );
}
