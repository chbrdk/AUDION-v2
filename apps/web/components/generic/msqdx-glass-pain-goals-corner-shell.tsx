"use client";

import type { ReactNode } from "react";
import { MsqdxCornerTabCard } from "../../lib/msqdx-corner-tab-card";
import type { MsqdxGlassChipVariant } from "./msqdx-glass-chip";
import {
  renderChipEditorCornerTab,
  resolveChipEditorCornerTabStyle,
} from "../../lib/chip-editor-corner-tab";

export type MsqdxGlassPainGoalsCornerShellProps = {
  chipVariant: MsqdxGlassChipVariant;
  label: string;
  children: ReactNode;
  /** @default 'top-left' */
  placement?: "top-left" | "top-right";
};

/**
 * Wraps pain/goals slider content in `MsqdxCornerTabCard` when variant is pain or goal.
 */
export function MsqdxGlassPainGoalsCornerShell({
  chipVariant,
  label,
  children,
  placement = "top-left",
}: MsqdxGlassPainGoalsCornerShellProps) {
  const cornerTabStyle = resolveChipEditorCornerTabStyle(chipVariant);
  if (!cornerTabStyle) {
    return <>{children}</>;
  }

  return (
    <MsqdxCornerTabCard
      className={`msqdx-glass-chip-editor__corner-tab-shell msqdx-glass-chip-editor__corner-tab-shell--${placement === "top-right" ? "right" : "left"}`}
      placement={placement}
      tab={renderChipEditorCornerTab(chipVariant, label)}
      tabAriaLabel={label}
      tabChromeColor="var(--color-primary-white, #ffffff)"
      tabColor={cornerTabStyle.tabColor}
      bodyColor="var(--color-primary-white, #ffffff)"
      bodyBorderRadiusPx={24}
      bodySx={{ pt: 1.25, pb: 0.25, px: 0.25 }}
    >
      {children}
    </MsqdxCornerTabCard>
  );
}
