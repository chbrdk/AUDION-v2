/**
 * Tailwind-inspired design token set for syncing to Figma variables.
 * Single source: colors (slate scale + semantic), spacing, radius.
 * Figma variable names use hyphens only (no dots): e.g. colors-slate-900, spacing-4, radius-md.
 */

import type { RGB } from './figma-command-schema';

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}

/** Tailwind slate palette (hex). */
const slate: Record<string, string> = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
};

/** All color tokens: scale (slate-50..950) + semantic (primary, background, …). */
export const colorTokens: Record<string, RGB> = (() => {
  const out: Record<string, RGB> = {};
  for (const [shade, hex] of Object.entries(slate)) {
    out[`slate-${shade}`] = hexToRgb(hex);
  }
  out['white'] = { r: 1, g: 1, b: 1 };
  out['black'] = { r: 0, g: 0, b: 0 };
  // Semantic (map to slate)
  out['background'] = hexToRgb(slate[50]);
  out['foreground'] = hexToRgb(slate[900]);
  out['primary'] = hexToRgb(slate[900]);
  out['primary-foreground'] = hexToRgb(slate[50]);
  out['secondary'] = hexToRgb(slate[100]);
  out['secondary-foreground'] = hexToRgb(slate[900]);
  out['muted'] = hexToRgb(slate[100]);
  out['muted-foreground'] = hexToRgb(slate[500]);
  out['border'] = hexToRgb(slate[200]);
  out['input'] = hexToRgb(slate[200]);
  out['ring'] = hexToRgb(slate[900]);
  out['card'] = hexToRgb(slate[50]);
  out['card-foreground'] = hexToRgb(slate[900]);
  out['avatar'] = hexToRgb(slate[400]);
  return out;
})();

/** Tailwind spacing scale: key = name (0,1,2,…,96), value = px. 1 unit = 4px. */
export const spacingTokens: Record<string, number> = {
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
  '24': 96,
  '32': 128,
  '40': 160,
  '48': 192,
  '64': 256,
  '80': 320,
  '96': 384,
};

/** Border radius: Tailwind-style names → px. */
export const radiusTokens: Record<string, number> = {
  'none': 0,
  'sm': 4,
  'md': 8,
  'lg': 12,
  'xl': 16,
  '2xl': 24,
  'full': 9999,
};

/** Single token entry for Figma variable creation. */
export type TokenEntry =
  | { key: string; type: 'COLOR'; value: RGB }
  | { key: string; type: 'FLOAT'; value: number };

/** Flatten all tokens for Figma sync. Keys are Figma-safe (no dots). */
export function getTailwindTokenList(): TokenEntry[] {
  const list: TokenEntry[] = [];
  for (const [key, value] of Object.entries(colorTokens)) {
    list.push({ key: `colors-${key}`, type: 'COLOR', value });
  }
  for (const [key, value] of Object.entries(spacingTokens)) {
    list.push({ key: `spacing-${key}`, type: 'FLOAT', value });
  }
  for (const [key, value] of Object.entries(radiusTokens)) {
    list.push({ key: `radius-${key}`, type: 'FLOAT', value });
  }
  return list;
}

/** Semantic variable keys we use when binding nodes (must exist in token list). */
export const SEMANTIC_VARIABLE_KEYS = [
  'colors-primary',
  'colors-primary-foreground',
  'colors-secondary',
  'colors-secondary-foreground',
  'colors-background',
  'colors-foreground',
  'colors-muted',
  'colors-muted-foreground',
  'colors-border',
  'colors-card',
  'colors-avatar',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'spacing-2',
  'spacing-3',
  'spacing-4',
  'spacing-6',
  'spacing-8',
] as const;

export type SemanticVariableKey = (typeof SEMANTIC_VARIABLE_KEYS)[number];
