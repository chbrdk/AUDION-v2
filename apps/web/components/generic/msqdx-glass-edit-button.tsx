"use client";

import { MsqdxButton, MsqdxIcon } from "@msqdx/react";

export type MsqdxGlassEditButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  "aria-label"?: string;
  size?: "small" | "medium" | "large";
  fontSize?: number;
};

const sizeMap = { small: "small" as const, medium: "medium" as const, large: "large" as const };

/**
 * Edit icon button using DS MsqdxButton.
 */
export const MsqdxGlassEditButton = ({
  onClick,
  disabled = false,
  "aria-label": ariaLabel = "Edit",
  size = "medium",
  fontSize = 16,
}: MsqdxGlassEditButtonProps) => (
  <MsqdxButton
    variant="outlined"
    size={sizeMap[size]}
    brandColor="purple"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    sx={{
      minWidth: 28,
      minHeight: 28,
      width: size === "small" ? 28 : size === "large" ? 36 : 32,
      height: size === "small" ? 28 : size === "large" ? 36 : 32,
      p: 0,
      borderRadius: "rounded",
    }}
  >
    <MsqdxIcon name="edit" customSize={fontSize} />
  </MsqdxButton>
);

