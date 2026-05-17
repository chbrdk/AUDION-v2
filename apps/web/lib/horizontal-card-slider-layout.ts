/** Default visible slides for pain/goals chip carousels (peek of next card). */
export const DEFAULT_HORIZONTAL_SLIDER_SLIDES_VISIBLE = 3.5;

/** Gaps between partially visible slides in the flex-basis formula. */
export function gapCountForSlidesVisible(slidesVisible: number): number {
  return Math.max(0, Math.ceil(slidesVisible) - 1);
}

/**
 * Fewer slides on narrow containers (section workspace, subnav, mobile).
 * Uses container width, not viewport — matches real content column width.
 */
export function resolveSlidesVisibleForContainerWidth(
  baseSlidesVisible: number,
  containerWidth: number
): number {
  if (containerWidth <= 0) {
    return baseSlidesVisible;
  }
  if (containerWidth >= 960) {
    return baseSlidesVisible;
  }
  if (containerWidth >= 720) {
    return Math.min(baseSlidesVisible, 2.5);
  }
  if (containerWidth >= 480) {
    return Math.min(baseSlidesVisible, 1.75);
  }
  return Math.min(baseSlidesVisible, 1.15);
}
