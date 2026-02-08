'use client';

import { MsqdxCard, MsqdxTypography, MsqdxIcon } from '@msqdx/react';
import { Box } from '@mui/material';

export type AdminDashboardProps = {
  personaCount?: number;
  targetGroupCount?: number;
  onNavigatePersonas?: () => void;
  onNavigateTargetGroups?: () => void;
};

export function AdminDashboard({
  personaCount = 0,
  targetGroupCount = 0,
  onNavigatePersonas,
  onNavigateTargetGroups,
}: AdminDashboardProps) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
      <MsqdxCard
        sx={{ p: 2, cursor: onNavigatePersonas ? 'pointer' : 'default' }}
        onClick={onNavigatePersonas}
      >
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <MsqdxIcon name="person" size="sm" />
          <MsqdxTypography variant="subtitle1" fontWeight={600}>
            Personas
          </MsqdxTypography>
        </Box>
        <MsqdxTypography variant="h4">{personaCount}</MsqdxTypography>
      </MsqdxCard>
      <MsqdxCard
        sx={{ p: 2, cursor: onNavigateTargetGroups ? 'pointer' : 'default' }}
        onClick={onNavigateTargetGroups}
      >
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <MsqdxIcon name="groups" size="sm" />
          <MsqdxTypography variant="subtitle1" fontWeight={600}>
            Target Groups
          </MsqdxTypography>
        </Box>
        <MsqdxTypography variant="h4">{targetGroupCount}</MsqdxTypography>
      </MsqdxCard>
    </Box>
  );
}
