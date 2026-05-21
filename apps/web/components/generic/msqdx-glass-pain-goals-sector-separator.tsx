"use client";

import { Box } from "@mui/material";
import { PAIN_GOALS_SECTOR_SEPARATOR_CORNER_KEYS } from "../../lib/pain-goals-sector-separator-layout";

/**
 * 1px sector line between pain and goals with frame-colored corner brackets
 * (same token as section workspace border). Corners use CSS cutdown-b `::before` patches.
 */
export function MsqdxGlassPainGoalsSectorSeparator() {
  return (
    <Box
      component="div"
      role="separator"
      aria-orientation="horizontal"
      className="msqdx-glass-pain-goals-sector-separator"
    >
      {PAIN_GOALS_SECTOR_SEPARATOR_CORNER_KEYS.map((corner) => (
        <span
          key={corner}
          className={`msqdx-glass-pain-goals-sector-separator__corner msqdx-glass-pain-goals-sector-separator__corner--${corner}`}
          aria-hidden
        />
      ))}
      <span className="msqdx-glass-pain-goals-sector-separator__line" aria-hidden />
    </Box>
  );
}
