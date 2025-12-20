"use client";

import { MsqdxGlassAiButtonIcon } from "../generic";

type Props = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
  fontSize?: number;
};

export const MsqdxGlassAiFieldButton = ({ 
  onClick, 
  loading = false, 
  disabled = false,
  size = "small",
  fontSize = 14,
}: Props) => {
  return (
    <MsqdxGlassAiButtonIcon
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      size={size}
      fontSize={fontSize}
      title="AI Vorschlag"
      aria-label="AI Vorschlag"
    />
  );
};

