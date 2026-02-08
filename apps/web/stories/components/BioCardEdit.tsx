'use client';

import { useState } from 'react';
import { DashboardCard } from './DashboardCard';
import { DashboardCardSection } from './DashboardCardSection';
import { MsqdxTypography, MsqdxFormField, MsqdxButton } from '@msqdx/react';
import { Box } from '@mui/material';

export type BioCardEditProps = {
  bio: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSave?: (bio: string) => Promise<void>;
};

export function BioCardEdit({ bio, expanded, onToggle, onSave }: BioCardEditProps) {
  const [localBio, setLocalBio] = useState(bio);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave(localBio);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <DashboardCard
      id="bio"
      title="Bio"
      icon="description"
      iconColor={{ color: '#a0a' }}
      expanded={expanded}
      onToggle={onToggle}
    >
      <DashboardCardSection title="Biography">
        <MsqdxFormField
          label="Bio"
          value={localBio}
          onChange={(e) => setLocalBio((e.target as HTMLTextAreaElement).value)}
          multiline
          minRows={3}
        />
        {onSave && (
          <MsqdxButton size="small" brandColor="green" onClick={handleSave} disabled={saving} sx={{ mt: 1 }}>
            Save
          </MsqdxButton>
        )}
      </DashboardCardSection>
    </DashboardCard>
  );
}
