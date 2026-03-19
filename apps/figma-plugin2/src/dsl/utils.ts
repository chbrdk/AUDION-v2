/**
 * DSL converter utilities: color conversion, padding normalization, alignment mapping.
 */

import type { Padding, Alignment, Justification } from './types';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return { r, g, b };
}

export function hexToRgba(hex: string): { color: RGB; opacity: number } {
  const clean = hex.replace('#', '');
  const color = hexToRgb(hex);
  const opacity =
    clean.length === 8 ? parseInt(clean.slice(6, 8), 16) / 255 : 1;
  return { color, opacity };
}

export function normalizePadding(
  p: Padding
): [number, number, number, number] {
  if (typeof p === 'number') return [p, p, p, p];
  if (p.length === 2) return [p[0], p[1], p[0], p[1]];
  return p;
}

export type FigmaAlign = 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
export type FigmaJustify = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';

export function mapAlignment(a: Alignment): FigmaAlign {
  switch (a) {
    case 'start':
      return 'MIN';
    case 'center':
      return 'CENTER';
    case 'end':
      return 'MAX';
    case 'stretch':
      return 'CENTER';
    default:
      return 'CENTER';
  }
}

export function mapJustification(j: Justification): FigmaJustify {
  switch (j) {
    case 'start':
      return 'MIN';
    case 'center':
      return 'CENTER';
    case 'end':
      return 'MAX';
    case 'space-between':
      return 'SPACE_BETWEEN';
    default:
      return 'MIN';
  }
}
