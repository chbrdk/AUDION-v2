/** Number of solid neutral steps (`--audion-neutral-00` … `--audion-neutral-19`). */
export const AUDION_NEUTRAL_STEP_COUNT = 20;

/** CSS custom property for a neutral step (0 = white, 19 = black). */
export function audionNeutralCssVar(step: number): string {
  const clamped = Math.max(0, Math.min(AUDION_NEUTRAL_STEP_COUNT - 1, Math.floor(step)));
  return `--audion-neutral-${String(clamped).padStart(2, "0")}`;
}

/** Light-theme ramp (same values as `styles/audion-neutral-scale.css`). */
export const AUDION_NEUTRAL_LIGHT: readonly string[] = [
  "#ffffff",
  "#fcfcfa",
  "#f8f7f3",
  "#f3f2ed",
  "#ecebe5",
  "#e4e3dc",
  "#dbd9d2",
  "#cfcdc5",
  "#bfbdb4",
  "#acaaa1",
  "#96948b",
  "#807e76",
  "#6a6861",
  "#55534d",
  "#424039",
  "#302f2a",
  "#22211d",
  "#181714",
  "#0f0f0d",
  "#000000",
] as const;

/** Semantic tokens used by pain/goals slider chrome (see `audion-neutral-scale.css`). */
export const AUDION_PAIN_GOALS_NEUTRAL_TOKENS = [
  "--msqdx-pain-goals-corner-surface",
  "--msqdx-pain-goals-slide-surface",
  "--msqdx-pain-goals-slide-surface-default",
  "--msqdx-pain-goals-slide-border-default",
  "--msqdx-pain-goals-scrollbar-thumb",
  "--msqdx-pain-goals-slide-surface-pain",
  "--msqdx-pain-goals-slide-surface-goal",
] as const;
