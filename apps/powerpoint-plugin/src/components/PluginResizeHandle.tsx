import React, { useCallback, useEffect, useRef } from 'react';

/**
 * Figma plugin windows are not natively user-resizable; dragging this handle posts
 * `resize` / `resize-commit` to the sandbox so `figma.ui.resize` runs (see code.ts).
 */
export function PluginResizeHandle() {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    pointerId: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ width: number; height: number } | null>(null);

  const flushResize = useCallback(() => {
    rafRef.current = null;
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    parent.postMessage({ pluginMessage: { type: 'resize', width: p.width, height: p.height } }, '*');
  }, []);

  const scheduleResize = useCallback(
    (width: number, height: number) => {
      pendingRef.current = { width, height };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushResize);
      }
    },
    [flushResize]
  );

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    []
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: window.innerWidth,
      startH: window.innerHeight,
      pointerId: e.pointerId,
    };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      scheduleResize(d.startW + dx, d.startH + dy);
    },
    [scheduleResize]
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const width = d.startW + dx;
    const height = d.startH + dy;
    parent.postMessage({ pluginMessage: { type: 'resize-commit', width, height } }, '*');
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize plugin panel"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        position: 'absolute',
        right: 2,
        bottom: 2,
        width: 22,
        height: 22,
        cursor: 'nwse-resize',
        zIndex: 20000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        padding: 4,
        boxSizing: 'border-box',
        touchAction: 'none',
        color: 'rgba(15, 23, 42, 0.35)',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <path d="M12 12H9v-3h3V12ZM12 7H7v3h5V7ZM7 12H4V9h3v3ZM12 2H9V0h3v2ZM7 7H4v3h3V7ZM2 12H0V9h2v3ZM7 2H4V0h3v2ZM2 7H0v5h2V7ZM2 2H0V0h2v2Z" />
      </svg>
    </div>
  );
}
