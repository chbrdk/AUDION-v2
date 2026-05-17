"use client";

import type { ReactNode } from "react";
import { MsqdxCornerTabCard } from "../../lib/msqdx-corner-tab-card";
import type { MsqdxGlassChipVariant } from "./msqdx-glass-chip";
import { ChipEditorCornerTabContent } from "../../lib/chip-editor-corner-tab-content";
import {
  CHIP_EDITOR_CORNER_SHELL_SURFACE,
  renderChipEditorCornerTab,
  resolveChipEditorCornerTabStyle,
} from "../../lib/chip-editor-corner-tab";

export type MsqdxGlassPainGoalsCornerShellProps = {
  chipVariant: MsqdxGlassChipVariant;
  label: string;
  children: ReactNode;
  /** @default 'top-right' */
  placement?: "top-left" | "top-right";
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
  tabActions,
}: MsqdxGlassPainGoalsCornerShellProps) {
  const cornerTabStyle = resolveChipEditorCornerTabStyle(chipVariant);
  if (!cornerTabStyle) {
    return <>{children}</>;
  }

  const hasTabActions = Boolean(tabActions);
  const tab = hasTabActions ? (
    <ChipEditorCornerTabContent variant={chipVariant} label={label}>
      {tabActions}
    </ChipEditorCornerTabContent>
  ) : (
    renderChipEditorCornerTab(chipVariant, label)
  );

  return (
    <MsqdxCornerTabCard
      className={[
        "msqdx-glass-chip-editor__corner-tab-shell",
        `msqdx-glass-chip-editor__corner-tab-shell--${placement === "top-right" ? "right" : "left"}`,
        hasTabActions && "msqdx-glass-chip-editor__corner-tab-shell--with-actions",
      ]
        .filter(Boolean)
        .join(" ")}
      placement={placement}
      tab={tab}
      tabWidthAuto={hasTabActions}
      tabAriaLabel={label}
      tabChromeColor={CHIP_EDITOR_CORNER_SHELL_SURFACE}
      tabColor={CHIP_EDITOR_CORNER_SHELL_SURFACE}
      bodyColor={CHIP_EDITOR_CORNER_SHELL_SURFACE}
      bodyBorderRadiusPx={24}
      bodySx={{ pt: 1.25, pb: 0.25, px: 0.25 }}
    >
      {children}
    </MsqdxCornerTabCard>
  );
}
