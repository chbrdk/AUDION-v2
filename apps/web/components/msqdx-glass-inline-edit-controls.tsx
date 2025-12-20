"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Box, IconButton, Tooltip, useTheme, alpha, Typography } from "@mui/material";
import { MaterialSymbol } from "./material-symbol";

export type MsqdxGlassInlineEditControlsProps = {
  /**
   * Whether there are unsaved changes
   */
  hasChanges: boolean;
  /**
   * Whether save operation is in progress
   */
  saving?: boolean;
  /**
   * Callback when save is triggered
   */
  onSave: () => void | Promise<void>;
  /**
   * Callback when discard is triggered
   */
  onDiscard: () => void;
  /**
   * The element that the controls should be positioned relative to
   */
  anchorElement?: HTMLElement | null;
  /**
   * Position of the tooltip relative to the anchor element
   */
  position?: "top" | "bottom" | "left" | "right";
};

export const MsqdxGlassInlineEditControls = ({
  hasChanges,
  saving = false,
  onSave,
  onDiscard,
  anchorElement,
  position = "top"
}: MsqdxGlassInlineEditControlsProps) => {
  const theme = useTheme();
  const controlsRef = useRef<HTMLDivElement>(null);
  const [computedPosition, setComputedPosition] = useState<{ top: number; left: number } | null>(null);
  const [showControls, setShowControls] = useState(false);

  // Small delay before showing controls to avoid flickering on rapid typing
  useEffect(() => {
    if (!hasChanges) {
      setShowControls(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowControls(true);
    }, 150); // 150ms delay (reduced for better UX)

    return () => clearTimeout(timer);
  }, [hasChanges]);

  useEffect(() => {
    if (!showControls || !hasChanges) {
      setComputedPosition(null);
      return;
    }

    // If no anchor element, use fallback position
    if (!anchorElement) {
      const fallback = typeof window !== "undefined" 
        ? { top: 100, left: window.innerWidth - 120 }
        : { top: 100, left: 100 };
      setComputedPosition(fallback);
      return;
    }

    const updatePosition = () => {
      if (!anchorElement) return;

      const anchorRect = anchorElement.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      const gap = 8;

      // Estimate controls size if not yet rendered
      const estimatedWidth = 80;
      const estimatedHeight = 40;

      let top = 0;
      let left = 0;

      switch (position) {
        case "top":
          top = anchorRect.top + scrollY - estimatedHeight - gap;
          left = anchorRect.left + scrollX + (anchorRect.width - estimatedWidth) / 2;
          break;
        case "bottom":
          top = anchorRect.bottom + scrollY + gap;
          left = anchorRect.left + scrollX + (anchorRect.width - estimatedWidth) / 2;
          break;
        case "left":
          top = anchorRect.top + scrollY + (anchorRect.height - estimatedHeight) / 2;
          left = anchorRect.left + scrollX - estimatedWidth - gap;
          break;
        case "right":
          top = anchorRect.top + scrollY + (anchorRect.height - estimatedHeight) / 2;
          left = anchorRect.right + scrollX + gap;
          break;
      }

      // Ensure controls stay within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < scrollX + gap) {
        left = scrollX + gap;
      } else if (left + estimatedWidth > scrollX + viewportWidth - gap) {
        left = scrollX + viewportWidth - estimatedWidth - gap;
      }

      if (top < scrollY + gap) {
        top = scrollY + gap;
      } else if (top + estimatedHeight > scrollY + viewportHeight - gap) {
        top = scrollY + viewportHeight - estimatedHeight - gap;
      }

      setComputedPosition({ top, left });

      // Refine position once controls are rendered
      if (controlsRef.current) {
        requestAnimationFrame(() => {
          if (!anchorElement || !controlsRef.current) return;
          const controlsRect = controlsRef.current.getBoundingClientRect();
          const refinedAnchorRect = anchorElement.getBoundingClientRect();

          let refinedTop = top;
          let refinedLeft = left;

          switch (position) {
            case "top":
              refinedTop = refinedAnchorRect.top + scrollY - controlsRect.height - gap;
              refinedLeft = refinedAnchorRect.left + scrollX + (refinedAnchorRect.width - controlsRect.width) / 2;
              break;
            case "bottom":
              refinedTop = refinedAnchorRect.bottom + scrollY + gap;
              refinedLeft = refinedAnchorRect.left + scrollX + (refinedAnchorRect.width - controlsRect.width) / 2;
              break;
            case "left":
              refinedTop = refinedAnchorRect.top + scrollY + (refinedAnchorRect.height - controlsRect.height) / 2;
              refinedLeft = refinedAnchorRect.left + scrollX - controlsRect.width - gap;
              break;
            case "right":
              refinedTop = refinedAnchorRect.top + scrollY + (refinedAnchorRect.height - controlsRect.height) / 2;
              refinedLeft = refinedAnchorRect.right + scrollX + gap;
              break;
          }

          // Re-check viewport constraints
          if (refinedLeft < scrollX + gap) {
            refinedLeft = scrollX + gap;
          } else if (refinedLeft + controlsRect.width > scrollX + viewportWidth - gap) {
            refinedLeft = scrollX + viewportWidth - controlsRect.width - gap;
          }

          if (refinedTop < scrollY + gap) {
            refinedTop = scrollY + gap;
          } else if (refinedTop + controlsRect.height > scrollY + viewportHeight - gap) {
            refinedTop = scrollY + viewportHeight - controlsRect.height - gap;
          }

          setComputedPosition({ top: refinedTop, left: refinedLeft });
        });
      }
    };

    // Initial position calculation
    updatePosition();

    // Update on scroll/resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [showControls, hasChanges, anchorElement, position]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show controls even if position isn't computed yet (fallback to top-right of viewport)
  if (!showControls || !hasChanges || !mounted) {
    return null;
  }

  // Use computed position if available, otherwise use fallback
  const fallbackPosition = typeof window !== "undefined" 
    ? { top: 100, left: window.innerWidth - 120 }
    : { top: 100, left: 100 };
  const displayPosition = computedPosition || fallbackPosition;

  const handleSave = async () => {
    await onSave();
  };

  const controls = (
    <Box
      ref={controlsRef}
      sx={{
        position: "fixed",
        top: displayPosition.top,
        left: displayPosition.left,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        backgroundColor: "var(--color-theme-accent)",
        backdropFilter: "blur(8px)",
        border: "1px solid var(--color-theme-accent)",
        borderRadius: 2,
        padding: "6px 4px",
        boxShadow: theme.shadows[12],
        animation: "slideIn 0.2s ease-out",
        pointerEvents: "auto"
      }}
    >
      <Typography
        variant="body2"
        sx={{
          color: "#ffffff",
          fontSize: "0.875rem",
          fontWeight: "bold",
          paddingLeft: "8px",
          paddingRight: "4px",
        }}
      >
        save?
      </Typography>
      <Tooltip title="Save changes" arrow>
        <IconButton
          size="small"
          onClick={handleSave}
          disabled={saving}
          sx={{
            color: "#ffffff",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.1)"
            },
            "&:disabled": {
              color: "rgba(255, 255, 255, 0.38)",
              opacity: 0.5
            }
          }}
        >
          <MaterialSymbol icon={saving ? "hourglass_empty" : "check"} fontSize={20} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Discard changes" arrow>
        <IconButton
          size="small"
          onClick={onDiscard}
          disabled={saving}
          sx={{
            color: "#ffffff",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.1)"
            },
            "&:disabled": {
              color: "rgba(255, 255, 255, 0.38)",
              opacity: 0.5
            }
          }}
        >
          <MaterialSymbol icon="close" fontSize={20} />
        </IconButton>
      </Tooltip>
    </Box>
  );

  // Render in portal to ensure it's above everything
  return createPortal(controls, document.body);
};

