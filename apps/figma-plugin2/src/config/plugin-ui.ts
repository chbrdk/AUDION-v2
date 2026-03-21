/**
 * Plugin panel sizing (figma.showUI / figma.ui.resize). Single source — use from code.ts + UI.
 */
export const PLUGIN_UI_STORAGE_KEY = 'audion-plugin2-ui-size-v1';

export const PLUGIN_UI_DEFAULT = {
  width: 400,
  height: 600,
} as const;

export const PLUGIN_UI_MIN = {
  width: 320,
  height: 380,
} as const;

export const PLUGIN_UI_MAX = {
  width: 1600,
  height: 1200,
} as const;

export function clampPluginUiSize(width: number, height: number): { width: number; height: number } {
  const w = Math.round(
    Math.min(PLUGIN_UI_MAX.width, Math.max(PLUGIN_UI_MIN.width, width))
  );
  const h = Math.round(
    Math.min(PLUGIN_UI_MAX.height, Math.max(PLUGIN_UI_MIN.height, height))
  );
  return { width: w, height: h };
}

export type StoredPluginUiSize = { width: number; height: number };

export function parseStoredPluginUiSize(raw: unknown): StoredPluginUiSize | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const width = typeof o.width === 'number' ? o.width : Number.NaN;
  const height = typeof o.height === 'number' ? o.height : Number.NaN;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return clampPluginUiSize(width, height);
}
