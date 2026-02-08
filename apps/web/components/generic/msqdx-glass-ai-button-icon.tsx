"use client";

import { MsqdxButton, MsqdxIcon } from "@msqdx/react";

export type MsqdxGlassAiButtonIconProps = {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  "aria-label"?: string;
  title?: string;
  size?: "small" | "medium" | "large";
  fontSize?: number;
};

const sizeMap = { small: "small" as const, medium: "medium" as const, large: "large" as const };

/**
 * AI suggestion icon button using DS MsqdxButton.
 */
export const MsqdxGlassAiButtonIcon = ({
  onClick,
  disabled = false,
  loading = false,
  "aria-label": ariaLabel = "AI Vorschlag",
  title = "AI Vorschlag",
  size = "medium",
  fontSize = 16,
}: MsqdxGlassAiButtonIconProps) => (
  <MsqdxButton
    variant="outlined"
    size={sizeMap[size]}
    brandColor="purple"
    onClick={onClick}
    disabled={disabled || loading}
    loading={loading}
    aria-label={ariaLabel}
    title={title}
    sx={{
      minWidth: 28,
      minHeight: 28,
      width: size === "small" ? 28 : size === "large" ? 36 : 32,
      height: size === "small" ? 28 : size === "large" ? 36 : 32,
      p: 0,
      borderRadius: "rounded",
    }}
  >
    <MsqdxIcon name={loading ? "hourglass_empty" : "auto_awesome"} customSize={fontSize} />
  </MsqdxButton>
);

