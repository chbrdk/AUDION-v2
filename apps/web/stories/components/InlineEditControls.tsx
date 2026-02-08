'use client';

import { MsqdxButton, MsqdxIcon } from '@msqdx/react';
import { Box } from '@mui/material';

export type InlineEditControlsProps = {
  hasChanges: boolean;
  saving?: boolean;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
};

export function InlineEditControls({
  hasChanges,
  saving = false,
  onSave,
  onDiscard,
}: InlineEditControlsProps) {
  if (!hasChanges) return null;

  return (
    <Box display="flex" gap={1} alignItems="center">
      <MsqdxButton
        size="small"
        brandColor="green"
        startIcon={<MsqdxIcon name="check" size="sm" />}
        onClick={() => onSave()}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save'}
      </MsqdxButton>
      <MsqdxButton
        size="small"
        variant="outlined"
        startIcon={<MsqdxIcon name="close" size="sm" />}
        onClick={onDiscard}
        disabled={saving}
      >
        Discard
      </MsqdxButton>
    </Box>
  );
}
