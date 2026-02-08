'use client';

import { MsqdxCollapsiblePanel, MsqdxTypography, MsqdxCard, MsqdxIcon } from '@msqdx/react';
import { Box } from '@mui/material';
import type { TargetGroup } from './TargetGroupCard';

export type TargetGroupAdminPanelProps = {
  targetGroups: TargetGroup[];
  onSelect?: (id: string) => void;
};

export function TargetGroupAdminPanel({ targetGroups, onSelect }: TargetGroupAdminPanelProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <MsqdxCollapsiblePanel title="Target Groups" defaultExpanded>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {targetGroups.length === 0 ? (
            <MsqdxTypography variant="body2" color="text.secondary">
              No target groups.
            </MsqdxTypography>
          ) : (
            targetGroups.map((tg) => (
              <MsqdxCard
                key={tg.id}
                sx={{
                  p: 1.5,
                  cursor: onSelect ? 'pointer' : 'default',
                }}
                onClick={() => onSelect?.(tg.id)}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <MsqdxIcon name="groups" size="sm" />
                  <Box flex={1}>
                    <MsqdxTypography variant="body2" fontWeight={500}>
                      {tg.name}
                    </MsqdxTypography>
                    <MsqdxTypography variant="caption" color="text.secondary">
                      {tg.personaCount} personas · {tg.knowledgeEntryCount} knowledge
                    </MsqdxTypography>
                  </Box>
                </Box>
              </MsqdxCard>
            ))
          )}
        </Box>
      </MsqdxCollapsiblePanel>
    </Box>
  );
}
