'use client';

import {
  MsqdxCollapsiblePanel,
  MsqdxTypography,
  MsqdxButton,
  MsqdxIcon,
  MsqdxCard,
} from '@msqdx/react';
import { Box } from '@mui/material';
import type { Persona } from './PersonaCard';

export type PersonaAdminPanelProps = {
  personas: Persona[];
  onSelectPersona?: (id: string) => void;
};

export function PersonaAdminPanel({ personas, onSelectPersona }: PersonaAdminPanelProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <MsqdxCollapsiblePanel title="Personas" defaultExpanded>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {personas.length === 0 ? (
            <MsqdxTypography variant="body2" color="text.secondary">
              No personas.
            </MsqdxTypography>
          ) : (
            personas.map((p) => (
              <MsqdxCard key={p.id} sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <MsqdxTypography variant="body2">{p.name}</MsqdxTypography>
                <MsqdxButton
                  size="small"
                  startIcon={<MsqdxIcon name="open_in_new" size="sm" />}
                  onClick={() => onSelectPersona?.(p.id)}
                >
                  Open
                </MsqdxButton>
              </MsqdxCard>
            ))
          )}
        </Box>
      </MsqdxCollapsiblePanel>
    </Box>
  );
}
