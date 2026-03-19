/**
 * Design token system for DSL converter. Default tokens + resolution (DSL → project → default).
 */

import type { TokenOverrides, Color } from './types';
import { hexToRgb, type RGB } from './utils';

export interface TypographyToken {
  family: string;
  style: string;
  size: number;
  lineHeight: number;
}

export interface ShadowToken {
  color: string;
  offset: { x: number; y: number };
  blur: number;
  spread: number;
}

export interface ButtonVariantToken {
  fill: string;
  text: string;
  radius: number;
  stroke?: string;
  underline?: boolean;
}

export interface ButtonSizeToken {
  paddingV: number;
  paddingH: number;
  fontSize: number;
}

export interface DesignTokens {
  colors: Record<string, string | Record<string, string>>;
  typography: Record<string, TypographyToken>;
  spacing: Record<string, number>;
  radii: Record<string, number>;
  shadows: Record<string, ShadowToken>;
  button: {
    primary: ButtonVariantToken;
    secondary: ButtonVariantToken;
    outline: ButtonVariantToken;
    ghost: ButtonVariantToken;
    link: ButtonVariantToken;
    sizes: { sm: ButtonSizeToken; md: ButtonSizeToken; lg: ButtonSizeToken };
  };
}

export const DEFAULT_TOKENS: DesignTokens = {
  colors: {
    primary: '#2563EB',
    secondary: '#7C3AED',
    accent: '#F59E0B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      tertiary: '#9CA3AF',
      inverse: '#FFFFFF',
    },
    border: '#E5E7EB',
  },

  typography: {
    display: { family: 'Inter', style: 'Bold', size: 64, lineHeight: 1.1 },
    'heading-xl': { family: 'Inter', style: 'Bold', size: 48, lineHeight: 1.15 },
    'heading-lg': { family: 'Inter', style: 'Bold', size: 36, lineHeight: 1.2 },
    'heading-md': {
      family: 'Inter',
      style: 'Semi Bold',
      size: 28,
      lineHeight: 1.3,
    },
    'heading-sm': {
      family: 'Inter',
      style: 'Semi Bold',
      size: 22,
      lineHeight: 1.35,
    },
    'body-lg': { family: 'Inter', style: 'Regular', size: 18, lineHeight: 1.6 },
    body: { family: 'Inter', style: 'Regular', size: 16, lineHeight: 1.6 },
    'body-sm': { family: 'Inter', style: 'Regular', size: 14, lineHeight: 1.5 },
    caption: { family: 'Inter', style: 'Regular', size: 12, lineHeight: 1.5 },
    overline: {
      family: 'Inter',
      style: 'Semi Bold',
      size: 12,
      lineHeight: 1.5,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },

  radii: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  shadows: {
    sm: { color: '#0000000D', offset: { x: 0, y: 1 }, blur: 2, spread: 0 },
    md: { color: '#0000001A', offset: { x: 0, y: 4 }, blur: 6, spread: -1 },
    lg: { color: '#0000001A', offset: { x: 0, y: 10 }, blur: 15, spread: -3 },
    xl: { color: '#00000025', offset: { x: 0, y: 20 }, blur: 25, spread: -5 },
  },

  button: {
    primary: { fill: '$primary', text: '#FFFFFF', radius: 8 },
    secondary: { fill: '$secondary', text: '#FFFFFF', radius: 8 },
    outline: {
      fill: 'transparent',
      text: '$primary',
      radius: 8,
      stroke: '$primary',
    },
    ghost: { fill: 'transparent', text: '$primary', radius: 8 },
    link: { fill: 'transparent', text: '$primary', radius: 0, underline: true },
    sizes: {
      sm: { paddingV: 8, paddingH: 16, fontSize: 14 },
      md: { paddingV: 12, paddingH: 24, fontSize: 16 },
      lg: { paddingV: 16, paddingH: 32, fontSize: 18 },
    },
  },
};

export type ResolvedTokens = DesignTokens;

function getColorValue(
  tokens: DesignTokens,
  key: string
): string | undefined {
  const colors = tokens.colors as Record<string, unknown>;
  if (key in colors && typeof colors[key] === 'string') {
    return colors[key] as string;
  }
  const parts = key.split('.');
  let cur: unknown = colors;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function resolveColor(value: Color, tokens: ResolvedTokens): RGB {
  if (value.startsWith('$')) {
    const key = value.slice(1);
    const resolved =
      getColorValue(tokens, key) ??
      getColorValue(DEFAULT_TOKENS, key);
    if (resolved) return hexToRgb(resolved);
  }
  return hexToRgb(value);
}

function deepMergeColors(
  target: Record<string, string | Record<string, string>>,
  source: Record<string, unknown>
): void {
  for (const [k, v] of Object.entries(source)) {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== 'object') {
        (target as Record<string, unknown>)[k] = { ...v };
      } else {
        deepMergeColors(
          target[k] as Record<string, string | Record<string, string>>,
          v as Record<string, unknown>
        );
      }
    } else if (typeof v === 'string') {
      (target as Record<string, unknown>)[k] = v;
    }
  }
}

export function resolveTokens(
  dslOverrides?: TokenOverrides | null,
  projectOverrides?: unknown
): ResolvedTokens {
  const base = JSON.parse(JSON.stringify(DEFAULT_TOKENS)) as DesignTokens;

  if (projectOverrides && typeof projectOverrides === 'object') {
    const proj = projectOverrides as { colors?: Record<string, unknown> };
    if (proj.colors) {
      deepMergeColors(base.colors, proj.colors);
    }
  }

  if (dslOverrides?.colors) {
    deepMergeColors(base.colors, dslOverrides.colors as Record<string, unknown>);
  }

  return base;
}
