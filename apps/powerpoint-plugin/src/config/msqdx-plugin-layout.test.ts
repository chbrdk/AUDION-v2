import {
  MSQDX_PLUGIN_BRAND_CSS_VAR,
  MSQDX_PLUGIN_LAYOUT,
  getMsqdxPluginInnerStyle,
} from './msqdx-plugin-layout';

describe('msqdx-plugin-layout', () => {
  it('matches MsqdxAppLayout (no sidebar + logo) token parity', () => {
    expect(MSQDX_PLUGIN_LAYOUT.borderWidthPx).toBe(10);
    expect(MSQDX_PLUGIN_LAYOUT.radiusButtonPx).toBe(32);
    expect(MSQDX_PLUGIN_LAYOUT.radius1_5xlPx).toBe(56);
    expect(MSQDX_PLUGIN_LAYOUT.cornerBoxRadiusPx).toBe(32);
    expect(MSQDX_PLUGIN_LAYOUT.paddingMdPx).toBe(16);
    expect(MSQDX_PLUGIN_LAYOUT.innerBackgroundColor.toLowerCase()).toBe('#f8f6f0');
  });

  it('getMsqdxPluginInnerStyle sets asymmetric radii and solid background', () => {
    const s = getMsqdxPluginInnerStyle(MSQDX_PLUGIN_BRAND_CSS_VAR);
    expect(s.borderTopLeftRadius).toBe(0);
    expect(s.borderTopRightRadius).toBe(32);
    expect(s.borderBottomLeftRadius).toBe(56);
    expect(s.borderBottomRightRadius).toBe(56);
    expect(s.border).toContain('10px solid');
    expect(s.backgroundColor).toBe('#f8f6f0');
    expect(s.backgroundImage).toBeUndefined();
  });
});
