'use client';

import { DashboardCard } from './DashboardCard';
import { DashboardCardSection } from './DashboardCardSection';
import { MsqdxTypography, MsqdxChip } from '@msqdx/react';
import { Box } from '@mui/material';

export type KnowledgeSource = {
  id: string;
  title: string;
  status: string;
};

export type KnowledgeSourcesCardProps = {
  sources: KnowledgeSource[];
  expanded: boolean;
  onToggle: (id: string) => void;
};

export function KnowledgeSourcesCard({ sources, expanded, onToggle }: KnowledgeSourcesCardProps) {
  return (
    <DashboardCard
      id="knowledge-sources"
      title="Knowledge sources"
      icon="menu_book"
      iconColor={{ color: '#06c' }}
      expanded={expanded}
      onToggle={onToggle}
    >
      <DashboardCardSection title="Documents">
        {sources.length === 0 ? (
          <MsqdxTypography variant="body2" color="text.secondary">
            No sources yet.
          </MsqdxTypography>
        ) : (
          <Box display="flex" flexDirection="column" gap={1}>
            {sources.map((s) => (
              <Box key={s.id} display="flex" alignItems="center" gap={1}>
                <MsqdxTypography variant="body2">{s.title}</MsqdxTypography>
                <MsqdxChip label={s.status} size="small" />
              </Box>
            ))}
          </Box>
        )}
      </DashboardCardSection>
    </DashboardCard>
  );
}
