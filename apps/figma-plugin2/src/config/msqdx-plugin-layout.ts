import type { CSSProperties } from 'react';

/**
 * Plugin UI reads the same CSS custom property set from settings (`brandColor` → `--msqdx-primary`).
 */
export const MSQDX_PLUGIN_BRAND_CSS_VAR = 'var(--msqdx-primary)' as const;

/**
 * Layout tokens aligned with @msqdx/react MsqdxAppLayout (no sidebar + logo + appName).
 * Source of truth in design system: MsqdxAppLayout.tsx, MsqdxCornerBox.tsx, spacing tokens.
 */
export const MSQDX_PLUGIN_LAYOUT = {
  /** MsqdxAppLayout borderWidth="thick" → APP_LAYOUT_BORDER_WIDTH.thick */
  borderWidthPx: 10,
  /** MSQDX_SPACING.borderRadius.button */
  radiusButtonPx: 32,
  /** MSQDX_SPACING.borderRadius["1.5xl"] */
  radius1_5xlPx: 56,
  /** MsqdxCornerBox borderRadius when used inside MsqdxAppLayout */
  cornerBoxRadiusPx: 32,
  /** MSQDX_SPACING.padding.md */
  paddingMdPx: 16,
  /** MSQDX_NEUTRAL.neutral – innerBackground "grid" / "offwhite" */
  innerBackgroundColor: '#f8f6f0',
  /**
   * Grid lines: alpha(MSQDX_NEUTRAL[900], 0.03) — same idea as MsqdxAppLayout GRID_LINE.
   * Single central definition; do not duplicate in components.
   */
  gridLineColor: 'rgba(23, 23, 23, 0.03)',
  gridSizePx: 20,
  /** Space for absolute top bar (Audion web glass header minHeight md) */
  topBarMinHeightPx: 56,
} as const;

/** CSS for .msqdx-plugin-inner (grid + border + radii without sidebar + corner header). */
export function getMsqdxPluginInnerStyle(brandBorder: string): CSSProperties {
  const w = MSQDX_PLUGIN_LAYOUT.borderWidthPx;
  const rBtn = MSQDX_PLUGIN_LAYOUT.radiusButtonPx;
  const r15 = MSQDX_PLUGIN_LAYOUT.radius1_5xlPx;
  const line = MSQDX_PLUGIN_LAYOUT.gridLineColor;
  const sz = MSQDX_PLUGIN_LAYOUT.gridSizePx;
  const bg = MSQDX_PLUGIN_LAYOUT.innerBackgroundColor;
  return {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
    boxSizing: 'border-box',
    border: `${w}px solid ${brandBorder}`,
    borderTopLeftRadius: 0,
    borderTopRightRadius: rBtn,
    borderBottomLeftRadius: r15,
    borderBottomRightRadius: r15,
    backgroundColor: bg,
    backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
    backgroundSize: `${sz}px ${sz}px`,
    backgroundAttachment: 'fixed',
  };
}

// Re-export for tests that only import layout constants
export type MsqdxPluginLayoutConstants = typeof MSQDX_PLUGIN_LAYOUT;
