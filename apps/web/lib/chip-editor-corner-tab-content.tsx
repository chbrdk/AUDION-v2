"use client";

import type { ComponentProps, ReactNode } from "react";
import { Box } from "@mui/material";
import { MsqdxGlassCornerTabSectionTab } from "../components/msqdx/corner-tab";

export type ChipEditorCornerTabContentProps = {
  /** Section title + count (e.g. Pain Points (15)). */
  heading?: ReactNode;
  children?: ReactNode;
};

type MsqdxGlassCornerTabSectionTabProps = ComponentProps<typeof MsqdxGlassCornerTabSectionTab>;

/** @deprecated Prefer {@link MsqdxGlassCornerTabSectionTab} or {@link MsqdxCornerTabSectionTab} from `@msqdx/react`. */
export function ChipEditorCornerTabContent({
  heading,
  children,
}: ChipEditorCornerTabContentProps) {
  return (
    <MsqdxGlassCornerTabSectionTab
      heading={heading as MsqdxGlassCornerTabSectionTabProps["heading"]}
      className="msqdx-glass-chip-editor__corner-tab-content"
      headingClassName="msqdx-glass-chip-editor__corner-tab-heading"
      actionsClassName="msqdx-glass-chip-editor__corner-tab-actions"
    >
      {children as MsqdxGlassCornerTabSectionTabProps["children"]}
    </MsqdxGlassCornerTabSectionTab>
  );
}

/** Icon + actions row used inside chip-editor corner tabs. */
export function ChipEditorCornerTabToolbar({ children }: { children: ReactNode }) {
  return (
    <Box
      className="msqdx-glass-chip-editor__corner-tab-toolbar"
      sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}
    >
      {children}
    </Box>
  );
}
