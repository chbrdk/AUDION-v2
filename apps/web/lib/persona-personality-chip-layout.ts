/** Shared chip typography inside the personality v2 section. */
export const PERSONALITY_CHIP_FONT_SIZE = "0.875rem";
export const PERSONALITY_CHIP_FONT_WEIGHT = "400";
export const PERSONALITY_CHIP_PADDING = "1rem 1.125rem";

/** Grid: 2 columns by default, 3 from `PERSONALITY_GRID_WIDE_MIN_WIDTH_PX` (interests + values blocks). */
export const PERSONALITY_GRID_COLUMNS_NARROW = 2;
export const PERSONALITY_GRID_COLUMNS_WIDE = 3;
export const PERSONALITY_GRID_WIDE_MIN_WIDTH_PX = 960;

export const PERSONALITY_CORNER_TAB_PLACEMENT = "top-right" as const;

export const PERSONALITY_TRAIT_CHIP_PROPS = {
  chipLayout: "inline" as const,
  relaxedSpacing: true,
  cornerTabPlacement: PERSONALITY_CORNER_TAB_PLACEMENT,
};

export const PERSONALITY_GRID_CHIP_PROPS = {
  chipLayout: "grid" as const,
  gridColumns: PERSONALITY_GRID_COLUMNS_NARROW,
  relaxedSpacing: true,
  cornerTabPlacement: PERSONALITY_CORNER_TAB_PLACEMENT,
} as const;
