"use client";

import { Box, IconButton, Tooltip } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";
import type { PersonasOverviewViewMode } from "../../lib/personas-overview-view-mode";

export type PersonasOverviewLayoutToggleProps = {
  value: PersonasOverviewViewMode;
  onChange: (mode: PersonasOverviewViewMode) => void;
  cardsLabel: string;
  listLabel: string;
  groupLabel: string;
};

export function PersonasOverviewLayoutToggle({
  value,
  onChange,
  cardsLabel,
  listLabel,
  groupLabel,
}: PersonasOverviewLayoutToggleProps) {
  const accent = "var(--color-theme-accent)";

  return (
    <Box
      role="group"
      aria-label={groupLabel}
      className="msqdx-glass-personas-layout-toggle"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
        p: 0.25,
        borderRadius: "999px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "rgba(0, 0, 0, 0.02)",
      }}
    >
      <Tooltip title={cardsLabel}>
        <IconButton
          size="small"
          aria-label={cardsLabel}
          aria-pressed={value === "cards"}
          onClick={() => onChange("cards")}
          sx={{
            borderRadius: "999px",
            color: value === "cards" ? "var(--color-theme-accent-contrast)" : accent,
            bgcolor: value === "cards" ? accent : "transparent",
            "&:hover": {
              bgcolor: value === "cards" ? accent : "rgba(0, 0, 0, 0.04)",
            },
          }}
        >
          <MsqdxIcon name="grid_view" customSize={20} />
        </IconButton>
      </Tooltip>
      <Tooltip title={listLabel}>
        <IconButton
          size="small"
          aria-label={listLabel}
          aria-pressed={value === "list"}
          onClick={() => onChange("list")}
          sx={{
            borderRadius: "999px",
            color: value === "list" ? "var(--color-theme-accent-contrast)" : accent,
            bgcolor: value === "list" ? accent : "transparent",
            "&:hover": {
              bgcolor: value === "list" ? accent : "rgba(0, 0, 0, 0.04)",
            },
          }}
        >
          <MsqdxIcon name="view_list" customSize={20} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
