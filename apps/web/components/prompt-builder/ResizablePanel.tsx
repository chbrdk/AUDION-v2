"use client";

import type { ReactNode } from "react";
import { useState, useRef, useEffect } from "react";
import { MsqdxIcon } from "@msqdx/react";
import { useI18n } from "../i18n/i18n-provider";

interface ResizablePanelProps {
  children: ReactNode;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  onResize?: (width: number) => void;
  side?: "left" | "right";
  collapsedWidth?: number;
}

export function ResizablePanel({ children, initialWidth, minWidth = 200, maxWidth, onResize, side = "right", collapsedWidth = 40 }: ResizablePanelProps) {
  const { t } = useI18n();
  const [width, setWidth] = useState(initialWidth || 280);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [savedWidth, setSavedWidth] = useState(initialWidth || 280);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // For right side panel: Handle is on the right edge
      //   - Dragging right (e.clientX increases) → moving handle away from panel → panel should get wider
      //   - Dragging left (e.clientX decreases) → moving handle toward panel → panel should get narrower
      // For left side panel: Handle is on the left edge  
      //   - Dragging right (e.clientX increases) → moving handle away from panel → panel should get wider
      //   - Dragging left (e.clientX decreases) → moving handle toward panel → panel should get narrower
      // For right side panel: Handle is on the right edge
      //   - Dragging right (e.clientX increases) → handle moves right → panel should get wider
      //   - But the handle is positioned at right: "-3px", so it's outside the panel
      //   - When dragging right, we want the panel to grow, so delta should be positive
      //   - However, for right side, the logic might need to be inverted
      // For left side panel: Handle is on the left edge
      //   - Dragging right (e.clientX increases) → handle moves right → panel should get wider
      //   - Delta = e.clientX - startXRef.current (positive = wider) ✓
      // For right side panel: Handle is on the right edge (right: "-3px")
      //   - Dragging right (e.clientX increases) → right edge moves right → panel gets wider
      //   - Delta should be positive: e.clientX - startXRef.current ✓
      // For left side panel: Handle is on the left edge (left: "-3px")  
      //   - Dragging right (e.clientX increases) → left edge moves right → panel gets narrower
      //   - To make it wider when dragging right, we need to move left edge LEFT
      //   - That means: delta should be negative when dragging right: startXRef.current - e.clientX
      //   - But wait, that would make it narrower when dragging right...
      //   - Actually: For left panel, dragging right should make it wider, so we invert:
      // Calculate mouse movement: positive = dragging right, negative = dragging left
      const mouseDelta = e.clientX - startXRef.current;
      
      // For side="right": Handle is on the right edge of the panel
      //   - Dragging right (mouseDelta positive) → right edge moves right → panel wider
      //   - widthDelta = mouseDelta (positive = wider) ✓
      // For side="left": Handle is on the left edge of the panel
      //   - Dragging right (mouseDelta positive) → left edge moves right → panel narrower
      //   - To make wider: left edge must move LEFT, so invert: widthDelta = -mouseDelta
      //   - Dragging right (positive mouseDelta) → negative widthDelta → left edge left → wider ✓
      const widthDelta = side === "left" ? -mouseDelta : mouseDelta;
      const newWidth = Math.max(minWidth, Math.min(maxWidth || Infinity, startWidthRef.current + widthDelta));
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
    if (isCollapsed) return;
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  };

  const handleToggleCollapse = () => {
    if (isCollapsed) {
      // Expand: restore saved width
      setIsCollapsed(false);
      setWidth(savedWidth);
      onResize?.(savedWidth);
    } else {
      // Collapse: save current width and collapse
      setSavedWidth(width);
      setIsCollapsed(true);
      setWidth(collapsedWidth);
      onResize?.(collapsedWidth);
    }
  };

  const currentWidth = isCollapsed ? collapsedWidth : width;
  const collapseIcon = side === "left" 
    ? (isCollapsed ? "chevron_left" : "chevron_right")
    : (isCollapsed ? "chevron_right" : "chevron_left");

  return (
    <div
      ref={panelRef}
      style={{
        width: `${currentWidth}px`,
        flexShrink: 0,
        position: "relative",
        display: "flex",
        overflow: "visible",
        transition: isCollapsed ? "width 0.3s ease" : "none",
      }}
    >
      {!isCollapsed && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      )}
      {isCollapsed && (
        <div style={{ 
          width: "100%", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          background: "var(--color-neutral)",
          borderRight: side === "left" ? "1px solid rgba(148, 163, 184, 0.2)" : "none",
          borderLeft: side === "right" ? "1px solid rgba(148, 163, 184, 0.2)" : "none",
        }}>
          <button
            onClick={handleToggleCollapse}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
              borderRadius: "4px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(148, 163, 184, 0.1)";
              e.currentTarget.style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
            title={isCollapsed ? t("promptBuilder.expandPanel") : t("promptBuilder.collapsePanel")}
          >
            <MsqdxIcon name={collapseIcon} customSize={20} />
          </button>
        </div>
      )}
      {!isCollapsed && (
        <button
          onClick={handleToggleCollapse}
          style={{
            position: "absolute",
            [side === "left" ? "left" : "right"]: "8px",
            top: "8px",
            background: "var(--color-neutral)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: "4px",
            cursor: "pointer",
            padding: "0.375rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-secondary)",
            zIndex: 30,
            transition: "all 0.2s ease",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-theme-accent)";
            e.currentTarget.style.color = "white";
            e.currentTarget.style.borderColor = "var(--color-theme-accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--color-neutral)";
            e.currentTarget.style.color = "var(--color-text-secondary)";
            e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.2)";
          }}
          title={t("promptBuilder.collapsePanel")}
        >
          <MsqdxIcon name={collapseIcon} customSize={18} />
        </button>
      )}
      {side === "right" && !isCollapsed && (
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
      {side === "left" && !isCollapsed && (
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

