"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

interface ResizablePanelProps {
  children: ReactNode;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  onResize?: (width: number) => void;
  side?: "left" | "right";
}

export function ResizablePanel({ children, initialWidth, minWidth = 200, maxWidth, onResize, side = "right" }: ResizablePanelProps) {
  const [width, setWidth] = useState(initialWidth || 280);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = side === "right" ? startXRef.current - e.clientX : e.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, Math.min(maxWidth || Infinity, startWidthRef.current + delta));
      setWidth(newWidth);
      onResize?.(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth, side, onResize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  };

  return (
    <div
      ref={panelRef}
      style={{
        width: `${width}px`,
        flexShrink: 0,
        position: "relative",
        display: "flex",
        overflow: "visible",
      }}
    >
      <div style={{ flex: 1, overflow: "hidden" }}>{children}</div>
      {side === "right" && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            right: "-3px",
            top: 0,
            bottom: 0,
            width: "6px",
            cursor: "col-resize",
            zIndex: 20,
            background: isResizing ? "rgba(182, 56, 255, 0.4)" : "rgba(148, 163, 184, 0.15)",
            borderRight: "1px solid rgba(148, 163, 184, 0.3)",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.background = "rgba(182, 56, 255, 0.25)";
              e.currentTarget.style.borderRight = "1px solid rgba(182, 56, 255, 0.5)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.background = "rgba(148, 163, 184, 0.15)";
              e.currentTarget.style.borderRight = "1px solid rgba(148, 163, 184, 0.3)";
            }
          }}
        />
      )}
      {side === "left" && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            left: "-3px",
            top: 0,
            bottom: 0,
            width: "6px",
            cursor: "col-resize",
            zIndex: 20,
            background: isResizing ? "rgba(182, 56, 255, 0.4)" : "rgba(148, 163, 184, 0.15)",
            borderLeft: "1px solid rgba(148, 163, 184, 0.3)",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.background = "rgba(182, 56, 255, 0.25)";
              e.currentTarget.style.borderLeft = "1px solid rgba(182, 56, 255, 0.5)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.background = "rgba(148, 163, 184, 0.15)";
              e.currentTarget.style.borderLeft = "1px solid rgba(148, 163, 184, 0.3)";
            }
          }}
        />
      )}
    </div>
  );
}

