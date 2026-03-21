import React, { type ReactNode } from 'react';
import {
  MSQDX_PLUGIN_BRAND_CSS_VAR,
  MSQDX_PLUGIN_LAYOUT,
  getMsqdxPluginInnerStyle,
} from '../config/msqdx-plugin-layout';
import { MsqdxPluginCornerHeader } from './MsqdxPluginCornerHeader';
import { PluginResizeHandle } from './PluginResizeHandle';

export interface MsqdxPluginAppShellProps {
  /** Right-aligned controls (Chat / Journeys / …) — same role as msqdx-glass-admin-header-bar. */
  topBarRight?: ReactNode;
  children: ReactNode;
}

export function MsqdxPluginAppShell({ topBarRight, children }: MsqdxPluginAppShellProps) {
  const hasTopBar = topBarRight != null;
  const contentPadTop = hasTopBar
    ? MSQDX_PLUGIN_LAYOUT.topBarMinHeightPx
    : MSQDX_PLUGIN_LAYOUT.paddingMdPx + 8;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '100%',
        overflow: 'hidden',
        backgroundColor: MSQDX_PLUGIN_BRAND_CSS_VAR,
      }}
    >
      <div style={getMsqdxPluginInnerStyle(MSQDX_PLUGIN_BRAND_CSS_VAR)}>
        <MsqdxPluginCornerHeader brandBackground={MSQDX_PLUGIN_BRAND_CSS_VAR} />

        {hasTopBar ? (
          <header
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              minHeight: MSQDX_PLUGIN_LAYOUT.topBarMinHeightPx,
              padding: '12px 16px',
              boxSizing: 'border-box',
              backgroundColor: 'transparent',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                gap: 8,
                alignItems: 'center',
              }}
            >
              {topBarRight}
            </div>
          </header>
        ) : null}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            className="scroll-container"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              padding: 16,
              paddingTop: contentPadTop,
            }}
          >
            {children}
          </div>
        </div>
        <PluginResizeHandle />
      </div>
    </div>
  );
}
