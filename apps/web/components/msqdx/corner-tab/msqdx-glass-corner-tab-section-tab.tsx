"use client";

import clsx from "clsx";
import { Box } from "@mui/material";
import type { ReactNode } from "react";

export type MsqdxGlassCornerTabSectionTabProps = {
  /** Section title rendered beside toolbar actions. */
  heading?: ReactNode;
  children?: ReactNode;
  className?: string;
  headingClassName?: string;
  actionsClassName?: string;
};

/** Heading + toolbar row inside the corner tab (`MsqdxCornerBox`). */
export function MsqdxGlassCornerTabSectionTab({
  heading,
  children,
  className,
  headingClassName,
  actionsClassName,
}: MsqdxGlassCornerTabSectionTabProps) {
  return (
    <Box
      className={clsx("msqdx-glass-corner-tab-section__tab-content", className)}
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "nowrap",
        gap: 0.75,
        minHeight: 40,
        pr: 0.25,
      }}
    >
      {heading ? (
        <Box
          className={clsx("msqdx-glass-corner-tab-section__tab-heading", headingClassName)}
          sx={{ flex: "1 1 auto", minWidth: 0 }}
        >
          {heading}
        </Box>
      ) : null}
      {children ? (
        <Box
          className={clsx("msqdx-glass-corner-tab-section__tab-actions", actionsClassName)}
          sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}
        >
          {children}
        </Box>
      ) : null}
    </Box>
  );
}
