import type { ReactNode } from "react";
import { MsqdxIcon } from "@msqdx/react";
import type { MsqdxGlassChipVariant } from "../components/generic/msqdx-glass-chip";

export type ChipEditorCornerTabStyle = {
  tabColor: string;
  tabIconColor: string;
};

const CHIP_EDITOR_CORNER_TAB_STYLES: Record<"pain" | "goal", ChipEditorCornerTabStyle> = {
  pain: {
    tabColor: "var(--color-secondary-dx-pink)",
    tabIconColor: "var(--color-primary-white, #ffffff)",
  },
  goal: {
    tabColor: "var(--color-secondary-dx-blue)",
    tabIconColor: "var(--color-primary-white, #ffffff)",
  },
};

const CHIP_EDITOR_CORNER_TAB_ICONS: Record<"pain" | "goal", string> = {
  pain: "sentiment_dissatisfied",
  goal: "flag",
};

export function resolveChipEditorCornerTabStyle(
  variant: MsqdxGlassChipVariant
): ChipEditorCornerTabStyle | null {
  if (variant === "pain" || variant === "goal") {
    return CHIP_EDITOR_CORNER_TAB_STYLES[variant];
  }
  return null;
}

export function renderChipEditorCornerTab(
  variant: MsqdxGlassChipVariant,
  ariaLabel: string
): ReactNode | undefined {
  const style = resolveChipEditorCornerTabStyle(variant);
  if (!style) return undefined;
  const iconName = variant === "pain" ? CHIP_EDITOR_CORNER_TAB_ICONS.pain : CHIP_EDITOR_CORNER_TAB_ICONS.goal;
  return (
    <MsqdxIcon
      name={iconName as "sentiment_dissatisfied"}
      customSize={18}
      style={{ color: style.tabIconColor }}
    />
  );
}
