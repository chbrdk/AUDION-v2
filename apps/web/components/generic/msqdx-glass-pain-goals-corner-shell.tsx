"use client";

import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { MsqdxCornerTabCard } from "../../lib/msqdx-corner-tab-card";
import type { MsqdxGlassChipVariant } from "./msqdx-glass-chip";
import { ChipEditorCornerTabContent } from "../../lib/chip-editor-corner-tab-content";
import {
  CHIP_EDITOR_CORNER_BORDER_RADIUS_PX,
  renderChipEditorCornerTab,
  resolveChipEditorCornerTabStyle,
} from "../../lib/chip-editor-corner-tab";

export type MsqdxGlassPainGoalsCornerShellProps = {
  chipVariant: MsqdxGlassChipVariant;
  label: string;
  children: ReactNode;
  /** @default 'top-right' */
  placement?: "top-left" | "top-right";
  /** Section title rendered inside the corner tab (`MsqdxCornerBox`). */
  tabHeading?: ReactNode;
  /** Toolbar + nav rendered inside the corner tab (`MsqdxCornerBox`). */
  tabActions?: ReactNode;
};

/**
 * Wraps pain/goals slider content in `MsqdxCornerTabCard` when variant is pain or goal.
 */
export function MsqdxGlassPainGoalsCornerShell({
  chipVariant,
  label,
  children,
  placement = "top-right",
  tabHeading,
  tabActions,
}: MsqdxGlassPainGoalsCornerShellProps) {
  const cornerTabStyle = resolveChipEditorCornerTabStyle(chipVariant);
  if (!cornerTabStyle) {
    return <>{children}</>;
  }

  const sectionIcon = renderChipEditorCornerTab(chipVariant, label);
  const tabActionsWithIcon = tabActions ? (
    <Box
      className="msqdx-glass-chip-editor__corner-tab-toolbar"
      sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}
    >
      {sectionIcon}
      {tabActions}
    </Box>
  ) : undefined;

  const hasTabChrome = Boolean(tabHeading) || Boolean(tabActionsWithIcon);
  const tab = hasTabChrome ? (
    <ChipEditorCornerTabContent heading={tabHeading}>{tabActionsWithIcon}</ChipEditorCornerTabContent>
  ) : (
    sectionIcon
  );

  return (
    <MsqdxCornerTabCard
      className={[
        "msqdx-glass-chip-editor__corner-tab-shell",
        `msqdx-glass-chip-editor__corner-tab-shell--${placement === "top-right" ? "right" : "left"}`,
        hasTabChrome && "msqdx-glass-chip-editor__corner-tab-shell--with-actions",
      ]
        .filter(Boolean)
        .join(" ")}
      placement={placement}
      tab={tab}
      tabWidthAuto={hasTabChrome}
      tabAriaLabel={label}
      bodyBorderRadiusPx={CHIP_EDITOR_CORNER_BORDER_RADIUS_PX}
      cornerBoxBorderRadiusPx={CHIP_EDITOR_CORNER_BORDER_RADIUS_PX}
      containerBorderRadiusPx={CHIP_EDITOR_CORNER_BORDER_RADIUS_PX}
      bodySx={{ pr: 0.25 }}
    >
      {children}
    </MsqdxCornerTabCard>
  );
}
