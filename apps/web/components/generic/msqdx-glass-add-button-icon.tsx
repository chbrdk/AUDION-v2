"use client";

import { MsqdxButton, MsqdxIcon } from "@msqdx/react";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassAddButtonIconProps = {
  onClick?: () => void;
  disabled?: boolean;
  "aria-label"?: string;
  size?: "small" | "medium" | "large";
  fontSize?: number;
};

const sizeMap = { small: "small" as const, medium: "medium" as const, large: "large" as const };

/** Add icon button — matches `MsqdxGlassEditButton` / `MsqdxGlassAiButtonIcon` chrome. */
export const MsqdxGlassAddButtonIcon = ({
  onClick,
  disabled = false,
  "aria-label": ariaLabel,
  size = "medium",
  fontSize = 16,
}: MsqdxGlassAddButtonIconProps) => {
  const { t } = useI18n();
  return (
    <MsqdxButton
      variant="outlined"
      size={sizeMap[size]}
      brandColor="purple"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? t("common.add")}
      sx={{
        minWidth: 28,
        minHeight: 28,
        width: size === "small" ? 28 : size === "large" ? 36 : 32,
        height: size === "small" ? 28 : size === "large" ? 36 : 32,
        p: 0,
        borderRadius: "rounded",
      }}
    >
      <MsqdxIcon name="add" customSize={fontSize} />
    </MsqdxButton>
  );
};
