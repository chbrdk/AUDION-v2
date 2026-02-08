"use client";

import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { MsqdxTypography } from "@msqdx/react";

export type MsqdxGlassDashboardCardSectionProps = {
  title?: string;
  children: ReactNode;
};

export const MsqdxGlassDashboardCardSection = ({
  title,
  children,
}: MsqdxGlassDashboardCardSectionProps) => (
  <Box className="msqdx-glass-dashboard-card-section" sx={{ mb: 2 }}>
    {title && (
      <MsqdxTypography
        variant="caption"
        sx={{
          display: "block",
          mb: 1,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "text.secondary",
        }}
      >
        {title}
      </MsqdxTypography>
    )}
    {children}
  </Box>
);

