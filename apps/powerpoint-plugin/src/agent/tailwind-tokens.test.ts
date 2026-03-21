/**
 * Tailwind tokens – structure and list for Figma sync.
 */

import {
  colorTokens,
  spacingTokens,
  radiusTokens,
  getTailwindTokenList,
  SEMANTIC_VARIABLE_KEYS,
} from './tailwind-tokens';

describe('tailwind-tokens', () => {
  it('exposes slate scale and semantic colors', () => {
    expect(colorTokens['slate-50']).toEqual({ r: 248 / 255, g: 250 / 255, b: 252 / 255 });
    expect(colorTokens['slate-900']).toBeDefined();
    expect(colorTokens['primary']).toEqual(colorTokens['slate-900']);
    expect(colorTokens['background']).toEqual(colorTokens['slate-50']);
  });

  it('exposes spacing scale in px', () => {
    expect(spacingTokens['0']).toBe(0);
    expect(spacingTokens['4']).toBe(16);
    expect(spacingTokens['8']).toBe(32);
  });

  it('exposes radius scale', () => {
    expect(radiusTokens['none']).toBe(0);
    expect(radiusTokens['md']).toBe(8);
    expect(radiusTokens['full']).toBe(9999);
  });

  it('getTailwindTokenList returns Figma-safe keys (hyphens only)', () => {
    const list = getTailwindTokenList();
    expect(list.length).toBeGreaterThan(30);
    const keys = list.map((e) => e.key);
    expect(keys).toContain('colors-primary');
    expect(keys).toContain('spacing-4');
    expect(keys).toContain('radius-md');
    keys.forEach((k) => {
      expect(k).not.toMatch(/\./);
    });
  });

  it('semantic keys exist in token list', () => {
    const list = getTailwindTokenList();
    const keySet = new Set(list.map((e) => e.key));
    SEMANTIC_VARIABLE_KEYS.forEach((k) => {
      expect(keySet.has(k)).toBe(true);
    });
  });
});
