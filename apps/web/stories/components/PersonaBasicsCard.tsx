'use client';

import { DashboardCard } from './DashboardCard';
import { DashboardCardSection } from './DashboardCardSection';
import { MsqdxTypography } from '@msqdx/react';
import { Box } from '@mui/material';

export type PersonaBasicsCardProps = {
  name: string;
  headline: string;
  segment: string;
  expanded: boolean;
  onToggle: (id: string) => void;
};

export function PersonaBasicsCard({
  name,
  headline,
  segment,
  expanded,
  onToggle,
}: PersonaBasicsCardProps) {
  return (
    <DashboardCard
      id="persona-basics"
      title="Basics"
      icon="person"
      iconColor={{ color: '#0a0' }}
      expanded={expanded}
      onToggle={onToggle}
    >
      <DashboardCardSection title="Overview">
        <Box display="flex" flexDirection="column" gap={1}>
          <MsqdxTypography variant="body2"><strong>Name:</strong> {name}</MsqdxTypography>
          <MsqdxTypography variant="body2"><strong>Segment:</strong> {segment}</MsqdxTypography>
          <MsqdxTypography variant="body2"><strong>Headline:</strong> {headline}</MsqdxTypography>
        </Box>
      </DashboardCardSection>
    </DashboardCard>
  );
}
