"use client";

import { Box } from "@mui/material";
import type { ReactNode } from "react";
import { renderChipEditorCornerTab } from "./chip-editor-corner-tab";
import type { MsqdxGlassChipVariant } from "../components/generic/msqdx-glass-chip";

export type ChipEditorCornerTabContentProps = {
  variant: MsqdxGlassChipVariant;
  label: string;
  children?: ReactNode;
};

/** Children render inside `MsqdxCornerTabCard` tab (`MsqdxCornerBox`) beside the icon. */
export function ChipEditorCornerTabContent({
  variant,
  label,
  children,
}: ChipEditorCornerTabContentProps) {
  return (
    <Box
      className="msqdx-glass-chip-editor__corner-tab-content"
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "nowrap",
        gap: 0.5,
        minHeight: 32,
        pr: 0.25,
      }}
    >
      {renderChipEditorCornerTab(variant, label)}
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
