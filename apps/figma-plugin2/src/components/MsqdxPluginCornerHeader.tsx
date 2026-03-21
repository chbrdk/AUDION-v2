import React, { type CSSProperties } from 'react';
import { MsqdxLogo } from './MsqdxLogo';
import { MSQDX_PLUGIN_LAYOUT } from '../config/msqdx-plugin-layout';

type CornerKey = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface CornerPatchDef {
  position: (size: number) => CSSProperties;
  maskCircle: string;
}

/** Mirrors MsqdxCornerBox CUTDOWN_DEFS (topRight cutdown-a, bottomLeft cutdown-b). */
const CUTDOWN_DEFS: Record<CornerKey, { a: CornerPatchDef; b: CornerPatchDef }> = {
  topLeft: {
    a: { position: (s) => ({ top: 0, left: -s }), maskCircle: '0% 100%' },
    b: { position: (s) => ({ top: -s, left: 0 }), maskCircle: '100% 0%' },
  },
  topRight: {
    a: { position: (s) => ({ top: 0, right: -s }), maskCircle: '100% 100%' },
    b: { position: (s) => ({ top: -s, right: 0 }), maskCircle: '0% 0%' },
  },
  bottomLeft: {
    a: { position: (s) => ({ bottom: 0, left: -s }), maskCircle: '0% 0%' },
    b: { position: (s) => ({ bottom: -s, left: 0 }), maskCircle: '100% 100%' },
  },
  bottomRight: {
    a: { position: (s) => ({ bottom: 0, right: -s }), maskCircle: '100% 0%' },
    b: { position: (s) => ({ bottom: -s, right: 0 }), maskCircle: '0% 100%' },
  },
};

function CutdownPatch({
  corner,
  variant,
  R,
}: {
  corner: CornerKey;
  variant: 'a' | 'b';
  R: number;
}) {
  const def = CUTDOWN_DEFS[corner][variant];
  const mask = `radial-gradient(circle at ${def.maskCircle}, transparent 0, transparent ${R}px, white ${R}px)`;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        width: R,
        height: R,
        ...def.position(R),
        background: 'inherit',
        pointerEvents: 'none',
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }}
    />
  );
}

export interface MsqdxPluginCornerHeaderProps {
  /** Same as MsqdxAppLayout: logo sits on brand color (typically var(--msqdx-primary)). */
  brandBackground: string;
  logoHeight?: number;
}

/**
 * Decorative corner + wordmark only (compact; no app title — saves horizontal space in narrow panel).
 */
export function MsqdxPluginCornerHeader({
  brandBackground,
  logoHeight = 20,
}: MsqdxPluginCornerHeaderProps) {
  const R = MSQDX_PLUGIN_LAYOUT.cornerBoxRadiusPx;
  const pad = MSQDX_PLUGIN_LAYOUT.paddingMdPx;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 10000,
        color: '#ffffff',
      }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'visible',
          backgroundColor: brandBackground,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: R,
          padding: `${Math.max(8, pad - 4)}px ${Math.max(10, pad - 4)}px`,
          display: 'flex',
          alignItems: 'center',
          minHeight: 26,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
            <MsqdxLogo height={logoHeight} color="currentColor" />
          </div>
        </div>
        <CutdownPatch corner="topRight" variant="a" R={R} />
        <CutdownPatch corner="bottomLeft" variant="b" R={R} />
      </div>
    </div>
  );
}
