'use client';

import { PersonaCard, type Persona } from './PersonaCard';
import { MsqdxTypography } from '@msqdx/react';
import { Box } from '@mui/material';

export type PersonaListProps = {
  personas: Persona[];
  selectedId?: string;
  onSelect?: (personaId: string) => void;
  actionLabel?: string;
};

export function PersonaList({ personas, selectedId, onSelect, actionLabel = 'Chat' }: PersonaListProps) {
  if (personas.length === 0) {
    return (
      <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
        <MsqdxTypography variant="body2" color="text.secondary">
          No personas in this Target Group.
        </MsqdxTypography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {personas.map((persona) => (
        <PersonaCard
          key={persona.id}
          persona={persona}
          selected={selectedId === persona.id}
          onSelect={onSelect}
          actionLabel={actionLabel}
        />
      ))}
    </Box>
  );
}
