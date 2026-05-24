"use client";

import type { ComponentProps, ReactNode } from "react";
import type { MsqdxGlassChipVariant } from "./msqdx-glass-chip";
import {
  MsqdxGlassCornerTabSection,
  MsqdxGlassCornerTabSectionTab,
} from "../msqdx/corner-tab";
import { ChipEditorCornerTabToolbar } from "../../lib/chip-editor-corner-tab-content";
import {
  renderChipEditorCornerTab,
  resolveChipEditorCornerTabStyle,
} from "../../lib/chip-editor-corner-tab";

type MsqdxGlassCornerTabSectionTabProps = ComponentProps<typeof MsqdxGlassCornerTabSectionTab>;
type MsqdxGlassCornerTabSectionChildren = ComponentProps<typeof MsqdxGlassCornerTabSection>["children"];
type MsqdxGlassCornerTabSectionTabProp = ComponentProps<typeof MsqdxGlassCornerTabSection>["tab"];

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
 * Chip-editor adapter for {@link MsqdxGlassCornerTabSection} (pain/goals, personality, etc.).
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
    <ChipEditorCornerTabToolbar>
      {sectionIcon}
      {tabActions}
    </ChipEditorCornerTabToolbar>
  ) : undefined;

  const hasTabToolbar = Boolean(tabHeading) || Boolean(tabActionsWithIcon);
  const tab = (hasTabToolbar ? (
    <MsqdxGlassCornerTabSectionTab heading={tabHeading as MsqdxGlassCornerTabSectionTabProps["heading"]}>
      {tabActionsWithIcon as MsqdxGlassCornerTabSectionTabProps["children"]}
    </MsqdxGlassCornerTabSectionTab>
  ) : (
    sectionIcon
  )) as MsqdxGlassCornerTabSectionTabProp;

  return (
    <MsqdxGlassCornerTabSection
      className={[
        "msqdx-glass-chip-editor__corner-tab-shell",
        `msqdx-glass-chip-editor__corner-tab-shell--${placement === "top-right" ? "right" : "left"}`,
        hasTabToolbar && "msqdx-glass-chip-editor__corner-tab-shell--with-actions",
      ]
        .filter(Boolean)
        .join(" ")}
      placement={placement}
      tab={tab}
      tabAriaLabel={label}
      tabToolbar={hasTabToolbar}
    >
      {children as MsqdxGlassCornerTabSectionChildren}
    </MsqdxGlassCornerTabSection>
  );
}
