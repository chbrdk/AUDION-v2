import type { SxProps, Theme } from "@mui/material/styles";

/** Inner scroll box for persona system-prompt tooltips (readable on light neutral tooltip background). */
export const systemPromptTooltipContentSx: SxProps<Theme> = {
  maxWidth: "400px",
  maxHeight: "300px",
  overflow: "auto",
  p: 1,
  whiteSpace: "pre-wrap",
  fontSize: "0.75rem",
  fontFamily: "monospace",
  backgroundColor: "transparent",
  color: "var(--color-text-primary)",
};
