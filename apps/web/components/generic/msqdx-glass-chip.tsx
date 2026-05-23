"use client";

import { useMemo, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import clsx from "clsx";

export type MsqdxGlassChipVariant = 
  | "trait" 
  | "vocab"
  | "sentence"
  | "pain" 
  | "goal" 
  | "value" 
  | "interest" 
  | "social"
  | "draft"
  | "published"
  | "archived"
  | "success"
  | "processing"
  | "error"
  | "pending";

export type MsqdxGlassChipSize = "small" | "medium" | "large";

export type MsqdxGlassChipProps = {
  /**
   * Chip content/text
   */
  children: ReactNode;
  /**
   * Chip variant (determines color scheme)
   */
  variant?: MsqdxGlassChipVariant;
  /**
   * Size variant
   */
  size?: MsqdxGlassChipSize;
  /**
   * Whether this chip is highlighted (e.g., newly added)
   */
  highlighted?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Click handler
   */
  onClick?: () => void;
  /**
   * Double-click handler (e.g. enter chip edit in persona admin).
   */
  onDoubleClick?: () => void;
  /**
   * Keyboard handler for interactive chips.
   */
  onKeyDown?: (event: KeyboardEvent<HTMLSpanElement>) => void;
  /**
   * Hover + focus affordance (pointer, chip hover styles).
   */
  interactive?: boolean;
  /**
   * Accessible name when interactive.
   */
  "aria-label"?: string;
  /**
   * Additional inline styles
   */
  style?: CSSProperties;
  /**
   * Whether chip is in dashboard context
   */
  dashboard?: boolean;
  /**
   * Priority level (for pain/goal/trait variants)
   */
  priority?: "high" | "medium" | "low";
};

/**
 * Centralized Chip Component
 * 
 * Provides consistent styling and behavior for all chip types across the application.
 * Supports different variants (trait, vocab, pain, goal, etc.) with configurable
 * colors, sizes, and states.
 */
export const MsqdxGlassChip = ({
  children,
  variant = "trait",
  size = "small",
  highlighted = false,
  className = "",
  onClick,
  onDoubleClick,
  onKeyDown,
  interactive = false,
  "aria-label": ariaLabel,
  style,
  dashboard = false,
  priority
}: MsqdxGlassChipProps) => {
  const isInteractive = interactive || Boolean(onClick) || Boolean(onDoubleClick);

  const chipClasses = useMemo(() => {
    const classes = ["msqdx-glass-chip"];

    if (dashboard) {
      classes.push("--dashboard");
    }

    if (variant) {
      classes.push(`--${variant}`);
    }

    if (highlighted) {
      classes.push("--is-new");
    }

    if (isInteractive) {
      classes.push("--interactive");
    }

    if (priority && (variant === "pain" || variant === "goal" || variant === "trait")) {
      classes.push(`--${variant}-${priority}`);
    }

    if (className) {
      classes.push(className);
    }

    return clsx(classes);
  }, [variant, highlighted, className, dashboard, priority, isInteractive]);

  const defaultStyle: CSSProperties = {
    cursor: isInteractive ? "pointer" : "default",
    display: "inline-flex",
    alignItems: "center",
    ...style,
  };

  return (
    <span
      className={chipClasses}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      style={defaultStyle}
    >
      {children}
    </span>
  );
};

