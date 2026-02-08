'use client';

import { useState } from 'react';
import { MsqdxFormField, MsqdxButton, MsqdxIcon, MsqdxTypography, MsqdxCheckboxField } from '@msqdx/react';
import { Box } from '@mui/material';

export type FieldDefinition = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'boolean';
  placeholder?: string;
};

export type FieldEditorProps = {
  field: FieldDefinition;
  value: string | number | boolean | null;
  onChange: (key: string, value: string | number | boolean | null) => void;
  onSave?: (key: string, value: string | number | boolean | null) => Promise<void>;
  inline?: boolean;
  disabled?: boolean;
};

export function FieldEditor({
  field,
  value,
  onChange,
  onSave,
  inline = true,
  disabled = false,
}: FieldEditorProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? (field.type === 'boolean' ? false : ''));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const v = field.type === 'boolean' ? Boolean(localValue) : localValue;
    onChange(field.key, v as any);
    if (onSave) {
      setSaving(true);
      try {
        await onSave(field.key, v as any);
        setEditing(false);
      } finally {
        setSaving(false);
      }
    } else {
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setLocalValue(value ?? (field.type === 'boolean' ? false : ''));
    setEditing(false);
  };

  if (field.type === 'boolean') {
    return (
      <MsqdxCheckboxField
        label={field.label}
        options={[{ value: 'on', label: 'Yes' }]}
        value={Boolean(value) ? ['on'] : []}
        onChange={(v) => onChange(field.key, v.includes('on'))}
      />
    );
  }

  if (!editing && inline) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <MsqdxTypography variant="body2">
          {field.label}: {String(value ?? '—')}
        </MsqdxTypography>
        {!disabled && (
          <MsqdxButton size="small" startIcon={<MsqdxIcon name="edit" size="sm" />} onClick={() => setEditing(true)}>
            Edit
          </MsqdxButton>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <MsqdxFormField
        label={field.label}
        type={field.type === 'textarea' ? 'textarea' : 'text'}
        value={localValue as string}
        onChange={(e) => setLocalValue((e.target as HTMLInputElement).value)}
        placeholder={field.placeholder}
        disabled={disabled}
      />
      <Box display="flex" gap={1} mt={1}>
        <MsqdxButton size="small" brandColor="green" onClick={handleSave} disabled={saving}>
          Save
        </MsqdxButton>
        <MsqdxButton size="small" variant="outlined" onClick={handleCancel}>
          Cancel
        </MsqdxButton>
      </Box>
    </Box>
  );
}
