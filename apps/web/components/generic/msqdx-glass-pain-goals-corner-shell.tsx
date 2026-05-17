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

  const hasTabChrome = Boolean(tabHeading) || Boolean(tabActions);
  const tab = hasTabChrome ? (
    <ChipEditorCornerTabContent heading={tabHeading}>{tabActions}</ChipEditorCornerTabContent>
  ) : (
    renderChipEditorCornerTab(chipVariant, label)
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
      tabChromeColor={CHIP_EDITOR_CORNER_SHELL_SURFACE}
      tabColor={CHIP_EDITOR_CORNER_SHELL_SURFACE}
      bodyColor={CHIP_EDITOR_CORNER_SHELL_SURFACE}
      bodyBorderRadiusPx={24}
      bodySx={{ pr: 0.25 }}
    >
      {children}
    </MsqdxCornerTabCard>
  );
}
