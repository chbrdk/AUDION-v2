'use client';

import type { ReactNode } from 'react';
import { MsqdxTypography } from '@msqdx/react';
import { Box } from '@mui/material';

export type DashboardCardSectionProps = {
  title?: string;
  children: ReactNode;
};

export function DashboardCardSection({ title, children }: DashboardCardSectionProps) {
  return (
    <Box sx={{ mb: 2 }}>
      {title && (
        <MsqdxTypography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          {title}
        </MsqdxTypography>
      )}
      {children}
    </Box>
  );
}
