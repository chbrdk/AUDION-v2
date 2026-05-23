"use client";

import { useMemo } from "react";
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
  children: React.ReactNode;
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
   * Additional inline styles
   */
  style?: React.CSSProperties;
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
  style,
  dashboard = false,
  priority
}: MsqdxGlassChipProps) => {
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
    
    if (priority && (variant === "pain" || variant === "goal" || variant === "trait")) {
      classes.push(`--${variant}-${priority}`);
    }
    
    if (className) {
      classes.push(className);
    }
    
    return clsx(classes);
  }, [variant, size, highlighted, className, dashboard, priority]);

  const defaultStyle: React.CSSProperties = {
    cursor: onClick ? "pointer" : "default",
    display: "inline-flex",
    alignItems: "center",
    ...style
  };

  return (
    <span
      className={chipClasses}
      onClick={onClick}
      style={defaultStyle}
    >
      {children}
    </span>
  );
};

