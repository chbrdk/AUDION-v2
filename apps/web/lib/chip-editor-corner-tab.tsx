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

export type ChipEditorCornerTabVariant =
  | "pain"
  | "goal"
  | "trait"
  | "interest"
  | "value"
  | "social"
  | "vocab";

const CHIP_EDITOR_CORNER_TAB_STYLES: Record<ChipEditorCornerTabVariant, ChipEditorCornerTabStyle> = {
  pain: {
    iconColor: "var(--color-secondary-dx-pink)",
  },
  goal: {
    iconColor: "var(--color-secondary-dx-blue)",
  },
  trait: {
    iconColor: "var(--color-secondary-dx-green)",
  },
  interest: {
    iconColor: "var(--color-secondary-dx-yellow)",
  },
  value: {
    iconColor: "var(--color-secondary-dx-green)",
  },
  social: {
    iconColor: "var(--color-secondary-dx-orange)",
  },
  vocab: {
    iconColor: "var(--color-secondary-dx-blue)",
  },
};

const CHIP_EDITOR_CORNER_TAB_ICONS: Record<ChipEditorCornerTabVariant, string> = {
  pain: "sentiment_dissatisfied",
  goal: "flag",
  trait: "psychology",
  interest: "lightbulb",
  value: "volunteer_activism",
  social: "share",
  vocab: "chat_bubble",
};

const CHIP_EDITOR_CORNER_TAB_VARIANTS = new Set<ChipEditorCornerTabVariant>(
  Object.keys(CHIP_EDITOR_CORNER_TAB_STYLES) as ChipEditorCornerTabVariant[]
);

function isChipEditorCornerTabVariant(
  variant: MsqdxGlassChipVariant
): variant is ChipEditorCornerTabVariant {
  return CHIP_EDITOR_CORNER_TAB_VARIANTS.has(variant as ChipEditorCornerTabVariant);
}

export function resolveChipEditorCornerTabStyle(
  variant: MsqdxGlassChipVariant
): ChipEditorCornerTabStyle | null {
  if (!isChipEditorCornerTabVariant(variant)) {
    return null;
  }
  return CHIP_EDITOR_CORNER_TAB_STYLES[variant];
}

export function renderChipEditorCornerTab(
  variant: MsqdxGlassChipVariant,
  ariaLabel: string
): ReactNode | undefined {
  const style = resolveChipEditorCornerTabStyle(variant);
  if (!style || !isChipEditorCornerTabVariant(variant)) return undefined;
  const iconName = CHIP_EDITOR_CORNER_TAB_ICONS[variant];
  return (
    <MsqdxIcon
      name={iconName as "sentiment_dissatisfied"}
      customSize={18}
      style={{ color: style.iconColor }}
      aria-label={ariaLabel}
    />
  );
}
