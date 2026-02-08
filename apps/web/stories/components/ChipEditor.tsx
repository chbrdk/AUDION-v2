'use client';

import { useState } from 'react';
import { MsqdxChip, MsqdxButton, MsqdxIcon, MsqdxInput, MsqdxTypography } from '@msqdx/react';
import { Box } from '@mui/material';

export type ChipEditorProps = {
  label: string;
  chips: string[];
  onSave: (chips: string[]) => Promise<void>;
  editable?: boolean;
  emptyMessage?: string;
};

export function ChipEditor({
  label,
  chips,
  onSave,
  editable = true,
  emptyMessage = 'No entries',
}: ChipEditorProps) {
  const [localChips, setLocalChips] = useState<string[]>(chips);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = () => {
    const v = newValue.trim();
    if (!v || localChips.includes(v)) return;
    setLocalChips((prev) => [...prev, v]);
    setNewValue('');
  };

  const handleRemove = (index: number) => {
    setLocalChips((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localChips);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <MsqdxTypography variant="body2" fontWeight={500}>
          {label}
        </MsqdxTypography>
        {editable && (
          <MsqdxButton size="small" brandColor="green" onClick={handleSave} disabled={saving}>
            Save
          </MsqdxButton>
        )}
      </Box>
      <Box display="flex" flexWrap="wrap" gap={0.5}>
        {localChips.length === 0 && (
          <MsqdxTypography variant="body2" color="text.secondary">
            {emptyMessage}
          </MsqdxTypography>
        )}
        {localChips.map((chip, i) => (
          <MsqdxChip
            key={`${chip}-${i}`}
            label={chip}
            size="small"
            onDelete={editable ? () => handleRemove(i) : undefined}
          />
        ))}
      </Box>
      {editable && (
        <Box display="flex" gap={0.5} mt={1}>
          <MsqdxInput
            size="small"
            placeholder="Add…"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            sx={{ flex: 1, minWidth: 100 }}
          />
          <MsqdxButton size="small" startIcon={<MsqdxIcon name="add" size="sm" />} onClick={handleAdd}>
            Add
          </MsqdxButton>
        </Box>
      )}
    </Box>
  );
}
