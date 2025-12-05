"use client";

import { IconButton } from "@mui/material";
import { MaterialSymbol } from "../material-symbol";

export type UdgGlassEditButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  "aria-label"?: string;
  size?: "small" | "medium" | "large";
  fontSize?: number;
};

/**
 * Generic Edit Button Component using MUI IconButton.
 * Consistent styling across the application with border and background.
 * Matches the styling of other icon buttons in the admin panel.
 */
export const UdgGlassEditButton = ({
  onClick,
  disabled = false,
  "aria-label": ariaLabel = "Edit",
  size = "medium",
  fontSize = 16,
}: UdgGlassEditButtonProps) => {
  // Calculate dimensions based on size
  const dimensions = {
    small: { size: "28px", padding: "0.375rem" },
    medium: { size: "32px", padding: "0.5rem" },
    large: { size: "36px", padding: "0.625rem" },
  };

  const { size: buttonSize, padding } = dimensions[size] || dimensions.medium;

  return (
    <IconButton
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      sx={{
        color: "var(--color-text-primary)",
        padding: padding,
        backgroundColor: "var(--color-neutral)",
        border: "1px solid var(--color-theme-accent)",
        width: buttonSize,
        height: buttonSize,
        minWidth: buttonSize,
        minHeight: buttonSize,
        "&:hover": {
          backgroundColor: "rgba(182, 56, 255, 0.1)",
        },
        "&:disabled": {
          backgroundColor: "var(--color-neutral)",
          borderColor: "var(--color-theme-accent)",
          opacity: 0.5,
        },
        transition: "all 0.2s ease",
      }}
    >
      <MaterialSymbol icon="edit" fontSize={fontSize} />
    </IconButton>
  );
};

