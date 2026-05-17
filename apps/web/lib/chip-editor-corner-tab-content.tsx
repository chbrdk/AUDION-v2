"use client";

import { Box } from "@mui/material";
import type { ReactNode } from "react";

export type ChipEditorCornerTabContentProps = {
  /** Section title + count (e.g. Pain Points (15)). */
  heading?: ReactNode;
  children?: ReactNode;
};

/** Heading and toolbar inside `MsqdxCornerTabCard` tab (`MsqdxCornerBox`). */
export function ChipEditorCornerTabContent({
  heading,
  children,
}: ChipEditorCornerTabContentProps) {
  return (
    <Box
      className="msqdx-glass-chip-editor__corner-tab-content"
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
        <Box className="msqdx-glass-chip-editor__corner-tab-heading" sx={{ flex: "1 1 auto", minWidth: 0 }}>
          {heading}
        </Box>
      ) : null}
      {children ? (
        <Box
          className="msqdx-glass-chip-editor__corner-tab-actions"
          sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}
        >
          {children}
        </Box>
      ) : null}
    </Box>
  );
}
