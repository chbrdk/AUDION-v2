'use client';

import { useState } from 'react';
import { MsqdxDialog, MsqdxButton, MsqdxFormField } from '@msqdx/react';
import { Box } from '@mui/material';

export type PersonaCreateRequest = {
  segment: string;
  description?: string;
};

export type PersonaCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (request: PersonaCreateRequest) => Promise<void>;
  loading?: boolean;
};

export function PersonaCreateDialog({
  open,
  onClose,
  onSubmit,
  loading = false,
}: PersonaCreateDialogProps) {
  const [segment, setSegment] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segment.trim()) return;
    try {
      await onSubmit({ segment: segment.trim(), description: description.trim() || undefined });
      setSegment('');
      setDescription('');
      onClose();
    } catch (err) {
      throw err;
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSegment('');
      setDescription('');
      onClose();
    }
  };

  return (
    <MsqdxDialog
      open={open}
      onClose={handleClose}
      title="Create Persona"
      brandColor="green"
      actions={
        <Box display="flex" gap={1} justifyContent="flex-end">
          <MsqdxButton variant="outlined" onClick={handleClose} disabled={loading}>
            Cancel
          </MsqdxButton>
          <MsqdxButton brandColor="green" onClick={handleSubmit} disabled={loading || !segment.trim()}>
            {loading ? 'Creating…' : 'Create'}
          </MsqdxButton>
        </Box>
      }
    >
      <form onSubmit={handleSubmit}>
        <Box display="flex" flexDirection="column" gap={2}>
          <MsqdxFormField
            label="Segment"
            value={segment}
            onChange={(e) => setSegment((e.target as HTMLInputElement).value)}
            placeholder="e.g. B2B SaaS"
            required
          />
          <MsqdxFormField
            label="Description"
            value={description}
            onChange={(e) => setDescription((e.target as HTMLInputElement).value)}
            placeholder="Optional"
          />
        </Box>
      </form>
    </MsqdxDialog>
  );
}
