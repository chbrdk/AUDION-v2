import {
  PERSONALITY_CORNER_TAB_PLACEMENT,
  PERSONALITY_GRID_CHIP_PROPS,
} from "./persona-personality-chip-layout";

/** Vocabulary chips in persona v2 communication (same grid + corner-tab shell as personality). */
export const COMMUNICATION_VOCABULARY_CHIP_PROPS = {
  ...PERSONALITY_GRID_CHIP_PROPS,
  cornerTabPlacement: PERSONALITY_CORNER_TAB_PLACEMENT,
} as const;

/** Single full-width sentence structure entry in communication v2. */
export const COMMUNICATION_SENTENCE_CHIP_PROPS = {
  ...COMMUNICATION_VOCABULARY_CHIP_PROPS,
  gridColumns: 2 as const,
} as const;
