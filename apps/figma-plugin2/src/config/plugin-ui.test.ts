import {
  clampPluginUiSize,
  parseStoredPluginUiSize,
  PLUGIN_UI_MAX,
  PLUGIN_UI_MIN,
} from './plugin-ui';

describe('plugin-ui', () => {
  it('clampPluginUiSize enforces min/max', () => {
    expect(clampPluginUiSize(100, 100)).toEqual({
      width: PLUGIN_UI_MIN.width,
      height: PLUGIN_UI_MIN.height,
    });
    expect(clampPluginUiSize(9999, 9999)).toEqual({
      width: PLUGIN_UI_MAX.width,
      height: PLUGIN_UI_MAX.height,
    });
    expect(clampPluginUiSize(420.7, 500.2)).toEqual({ width: 421, height: 500 });
  });

  it('parseStoredPluginUiSize rejects invalid payloads', () => {
    expect(parseStoredPluginUiSize(null)).toBeNull();
    expect(parseStoredPluginUiSize({})).toBeNull();
    expect(parseStoredPluginUiSize({ width: 'x', height: 1 })).toBeNull();
    expect(parseStoredPluginUiSize({ width: 400, height: 500 })).toEqual({
      width: 400,
      height: 500,
    });
  });
});
