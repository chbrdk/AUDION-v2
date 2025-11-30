"use client";

import { useMemo } from "react";
import clsx from "clsx";

export type UdgGlassChipVariant = 
  | "trait" 
  | "vocab" 
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

export type UdgGlassChipSize = "small" | "medium" | "large";

export type UdgGlassChipProps = {
  /**
   * Chip content/text
   */
  children: React.ReactNode;
  /**
   * Chip variant (determines color scheme)
   */
  variant?: UdgGlassChipVariant;
  /**
   * Size variant
   */
  size?: UdgGlassChipSize;
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
export const UdgGlassChip = ({
  children,
  variant = "trait",
  size = "small",
  highlighted = false,
  className = "",
  onClick,
  style,
  dashboard = false,
  priority
}: UdgGlassChipProps) => {
  const chipClasses = useMemo(() => {
    const classes = ["udg-glass-chip"];
    
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

