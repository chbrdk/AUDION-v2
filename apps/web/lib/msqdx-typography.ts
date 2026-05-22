/** MSQDX mono stack — IBM Plex Mono via `globals.css` + `layout.tsx` font variable. */
export const MSQDX_MONO_FONT_FAMILY = "var(--msqdx-font-family-mono)";

export const MONO_FONT_SX = {
  fontFamily: MSQDX_MONO_FONT_FAMILY,
} as const;

/** Slider/list section titles (e.g. Pain Points) — IBM Plex Mono, weight 100. */
export const SECTION_HEADING_MONO_SX = {
  ...MONO_FONT_SX,
  fontWeight: 100,
  textTransform: "none",
  letterSpacing: 0,
  lineHeight: 1.2,
  color: "text.primary",
} as const;

export {
  PERSONA_V2_SECTION_HEADING_COUNT_FONT_SIZE,
  PERSONA_V2_SECTION_HEADING_FONT_SIZE,
  PERSONA_V2_SECTION_HEADING_FONT_WEIGHT,
  PERSONA_V2_SECTION_HEADING_LINE_HEIGHT,
} from "./persona-v2-section-heading";
