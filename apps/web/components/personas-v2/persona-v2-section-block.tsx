"use client";

import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { MsqdxTypography } from "@msqdx/react";
import { SECTION_HEADING_MONO_SX } from "../../lib/msqdx-typography";

export type PersonaV2SectionBlockProps = {
  /** Omit when the section shell workspace header already names this block. */
  title?: string;
  children: ReactNode;
  className?: string;
};

/** Flat persona v2 content block with optional mono section heading. */
export function PersonaV2SectionBlock({ title, children, className }: PersonaV2SectionBlockProps) {
  return (
    <Box
      component="article"
      className={["msqdx-glass-persona-v2-section-block", className].filter(Boolean).join(" ")}
    >
      {title ? (
        <Box
          className="msqdx-glass-chip-editor__section-heading"
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: 1,
            flexWrap: "wrap",
            minWidth: 0,
            mb: "var(--msqdx-spacing-md)",
          }}
        >
          <MsqdxTypography variant="h3" component="h3" sx={SECTION_HEADING_MONO_SX}>
            {title}
          </MsqdxTypography>
        </Box>
      ) : null}
      {children}
    </Box>
  );
}
