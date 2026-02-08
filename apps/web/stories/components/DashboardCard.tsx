'use client';

import type { ReactNode } from 'react';
import { MsqdxCard, MsqdxTypography, MsqdxIcon } from '@msqdx/react';
import { Box } from '@mui/material';

export type DashboardCardProps = {
  id: string;
  title: string;
  icon: string;
  iconColor?: { background?: string; color: string };
  expanded: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
};

export function DashboardCard({
  id,
  title,
  icon,
  iconColor,
  expanded,
  onToggle,
  children,
}: DashboardCardProps) {
  return (
    <MsqdxCard
      sx={{
        overflow: 'hidden',
        borderColor: iconColor?.color,
        borderWidth: iconColor?.color ? 1 : 0,
        borderStyle: 'solid',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: iconColor?.color ? `1px solid ${iconColor.color}` : undefined,
          cursor: 'pointer',
          bgcolor: iconColor?.background,
        }}
        onClick={() => onToggle(id)}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <MsqdxIcon name={icon as any} size="sm" />
          <MsqdxTypography variant="subtitle1" fontWeight={600}>
            {title}
          </MsqdxTypography>
        </Box>
        <MsqdxIcon name={expanded ? 'expand_less' : 'expand_more'} size="sm" />
      </Box>
      {expanded && <Box sx={{ px: 2, py: 1.5 }}>{children}</Box>}
    </MsqdxCard>
  );
}
