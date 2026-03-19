/**
 * Design tokens – smoke tests (structure and fillFromToken).
 */

import { tokens, fillFromToken, type SpacingPreset } from './design-tokens';

describe('design-tokens', () => {
  it('exposes tokens with expected structure', () => {
    expect(tokens.colors.primary).toEqual({ r: 0.09, g: 0.09, b: 0.11 });
    expect(tokens.radius.md).toBe(8);
    expect(tokens.spacing[3]).toBe(12);
    expect(tokens.sectionPresets.normal).toEqual({ gap: 16, padding: 20 });
    expect(tokens.typography.fontFamily).toBe('Inter');
    expect(tokens.typography.body.fontSize).toBe(14);
    expect(tokens.sizing.buttonHeight).toBe(44);
  });

  it('fillFromToken returns SolidFill with opacity 1 by default', () => {
    const fill = fillFromToken(tokens.colors.primary);
    expect(fill).toEqual({ type: 'SOLID', color: tokens.colors.primary, opacity: 1 });
  });

  it('fillFromToken accepts custom opacity', () => {
    const fill = fillFromToken(tokens.colors.border, 0.5);
    expect(fill.opacity).toBe(0.5);
  });

  it('SpacingPreset is compact | normal | spacious', () => {
    const presets: SpacingPreset[] = ['compact', 'normal', 'spacious'];
    presets.forEach((p) => {
      expect(tokens.sectionPresets[p]).toBeDefined();
      expect(tokens.sectionPresets[p]).toHaveProperty('gap');
      expect(tokens.sectionPresets[p]).toHaveProperty('padding');
    });
  });
});
