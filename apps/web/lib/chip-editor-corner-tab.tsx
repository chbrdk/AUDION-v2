import type { ReactNode } from "react";
import { MsqdxIcon } from "@msqdx/react";
import type { MsqdxGlassChipVariant } from "../components/generic/msqdx-glass-chip";

/** Shared with `MsqdxCornerTabCard` body and tab chrome (light/dark via CSS on shell). */
export const CHIP_EDITOR_CORNER_SHELL_SURFACE =
  "var(--msqdx-pain-goals-corner-surface, var(--audion-neutral-00, #ffffff))";

/** Matches `--msqdx-radius-3xl`; tab box + card body share the same corner radius. */
export const CHIP_EDITOR_CORNER_BORDER_RADIUS_PX = 24;

export const PAIN_GOALS_SLIDE_INDEX_BADGE_RADIUS_PX = 22;

/** Width/height of index cutout (must match `clip-path` on `.msqdx-glass-pain-goals-slide-card__body--indexed`). */
export const PAIN_GOALS_SLIDE_INDEX_BADGE_SIZE = "4rem";

/** Index badge on each slide — same shade as corner-tab shell / body (not the slide card). */
export const PAIN_GOALS_SLIDE_INDEX_SURFACE = CHIP_EDITOR_CORNER_SHELL_SURFACE;

export type ChipEditorCornerTabStyle = {
  iconColor: string;
};

const CHIP_EDITOR_CORNER_TAB_STYLES: Record<"pain" | "goal", ChipEditorCornerTabStyle> = {
  pain: {
    iconColor: "var(--color-secondary-dx-pink)",
  },
  goal: {
    iconColor: "var(--color-secondary-dx-blue)",
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
      style={{ color: style.iconColor }}
    />
  );
}
