/**
 * Design tokens for wireframe generation (shadcn/radix-inspired).
 * Single source of truth for colors, radius, spacing, typography, and sizing.
 * Used by figma-atoms and figma-molecules so all generated nodes stay consistent.
 */

import type { RGB } from './figma-command-schema';

export const tokens = {
  colors: {
    background: { r: 1, g: 1, b: 1 } as RGB,
    foreground: { r: 0.09, g: 0.09, b: 0.11 } as RGB,
    muted: { r: 0.96, g: 0.96, b: 0.96 } as RGB,
    mutedForeground: { r: 0.45, g: 0.45, b: 0.45 } as RGB,
    primary: { r: 0.09, g: 0.09, b: 0.11 } as RGB,
    primaryForeground: { r: 1, g: 1, b: 1 } as RGB,
    secondary: { r: 0.96, g: 0.96, b: 0.96 } as RGB,
    secondaryForeground: { r: 0.09, g: 0.09, b: 0.11 } as RGB,
    accent: { r: 0.96, g: 0.96, b: 0.96 } as RGB,
    border: { r: 0.89, g: 0.89, b: 0.91 } as RGB,
    input: { r: 0.89, g: 0.89, b: 0.91 } as RGB,
    ring: { r: 0.09, g: 0.09, b: 0.11 } as RGB,
    placeholder: { r: 0.55, g: 0.55, b: 0.55 } as RGB,
    card: { r: 0.92, g: 0.92, b: 0.94 } as RGB,
    avatar: { r: 0.75, g: 0.75, b: 0.78 } as RGB,
  },
  radius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },
  /** Section presets: gap and padding (used by createSection, createRow). */
  sectionPresets: {
    compact: { gap: 8, padding: 12 },
    normal: { gap: 16, padding: 20 },
    spacious: { gap: 24, padding: 32 },
  } as const,
  typography: {
    fontFamily: 'Inter',
    h1: { fontSize: 24, fontStyle: 'Bold' as const },
    h2: { fontSize: 20, fontStyle: 'Bold' as const },
    h3: { fontSize: 18, fontStyle: 'Semi Bold' as const },
    body: { fontSize: 14, fontStyle: 'Regular' as const },
    small: { fontSize: 12, fontStyle: 'Regular' as const },
    caption: { fontSize: 11, fontStyle: 'Regular' as const },
  },
  sizing: {
    buttonHeight: 44,
    buttonPaddingX: 12,
    buttonMinWidth: 140,
    inputHeight: 36,
    inputWidth: 280,
    textareaWidth: 280,
    textareaRowHeight: 24,
    textareaMinRows: 2,
    textareaMaxRows: 8,
    headerHeight: 64,
    footerHeight: 56,
    iconSize: 24,
    logoWidth: 80,
    logoHeight: 32,
    checkboxSize: 18,
    radioSize: 18,
    avatarSize: 40,
    tableRowHeight: 36,
    tableCellPadding: 8,
    tableCellMinWidth: 60,
    listItemHeight: 20,
    listItemSpacing: 6,
    bulletSize: 6,
  },
} as const;

export type SpacingPreset = keyof typeof tokens.sectionPresets;

/** Build SolidFill from a token RGB (opacity 1). */
export function fillFromToken(color: RGB, opacity = 1) {
  return { type: 'SOLID' as const, color, opacity };
}
