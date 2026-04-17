import type { SxProps, Theme } from "@mui/material/styles";

/** Inner scroll area for system prompt body inside the tooltip. */
export const systemPromptTooltipContentSx: SxProps<Theme> = {
  maxWidth: "400px",
  maxHeight: "300px",
  overflow: "auto",
  p: 1,
  whiteSpace: "pre-wrap",
  fontSize: "0.75rem",
  fontFamily: "monospace",
  backgroundColor: "transparent",
};

/**
 * MUI Tooltip slot styles (`slotProps.tooltip.sx`).
 * Uses theme text color so copy stays legible; avoids `--color-text-primary`, which is not always defined on :root.
 */
export const systemPromptTooltipSlotSx: SxProps<Theme> = {
  backgroundColor: "var(--color-neutral)",
  border: "1px solid var(--audion-light-border-color, #0f172a)",
  borderRadius: "8px",
  maxWidth: "500px",
  padding: 0,
  color: (theme) => theme.palette.text.primary,
};
