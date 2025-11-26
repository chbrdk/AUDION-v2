"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { FieldDefinition } from "@udg-glass/types";
import { TextField, MenuItem, Select, FormControl, InputLabel, Slider, Typography, Stack, Box, Checkbox } from "@mui/material";
import { MaterialSymbol } from "../material-symbol";
import { useInlineEdit } from "../hooks/use-inline-edit";
import { UdgGlassInlineEditControls } from "../udg-glass-inline-edit-controls";

export type UdgGlassFieldEditorProps = {
  field: FieldDefinition;
  value: any;
  onChange: (key: string, value: any) => void;
  onSave?: (key: string, value: any) => Promise<void>;
  inline?: boolean;
  disabled?: boolean;
};

/**
 * Generische Feld-Editor Komponente.
 * Unterstützt alle Feld-Typen (text, number, select, textarea, slider, date, boolean).
 */
export const UdgGlassFieldEditor = ({
  field,
  value,
  onChange,
  onSave,
  inline = true,
  disabled = false,
}: UdgGlassFieldEditorProps) => {
  const [editing, setEditing] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);

  const inlineEdit = useInlineEdit({
    initialValue: value ?? (field.type === "boolean" ? false : null),
    currentValue: value ?? (field.type === "boolean" ? false : null),
    isEqual: (a, b) => {
      // Handle null/undefined equality
      if (a === null || a === undefined) {
        return b === null || b === undefined;
      }
      if (b === null || b === undefined) {
        return false;
      }
      return a === b;
    },
  });

  const handleSave = useCallback(async () => {
    if (onSave) {
      try {
        await onSave(field.key, inlineEdit.getValue());
        onChange(field.key, inlineEdit.getValue());
        setEditing(false);
      } catch (error) {
        console.error(`Save failed for field ${field.key}:`, error);
        throw error;
      }
    } else {
      onChange(field.key, inlineEdit.getValue());
      setEditing(false);
    }
  }, [field.key, inlineEdit, onChange, onSave]);

  const handleCancel = useCallback(() => {
    inlineEdit.reset();
    setEditing(false);
  }, [inlineEdit]);

  // Render field input based on type
  const renderFieldInput = () => {
    const currentValue = inlineEdit.value ?? (field.type === "boolean" ? false : null);

    switch (field.type) {
      case "text":
      case "textarea":
        return (
          <TextField
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            value={currentValue ?? ""}
            onChange={(e) => inlineEdit.setValue(e.target.value || null)}
            placeholder={field.config?.placeholder}
            multiline={field.type === "textarea"}
            rows={field.type === "textarea" ? 3 : undefined}
            disabled={disabled}
            required={field.config?.required}
            autoFocus
            size="small"
            fullWidth
          />
        );

      case "number":
        return (
          <TextField
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            type="number"
            value={currentValue ?? ""}
            onChange={(e) => {
              const numValue = e.target.value ? Number(e.target.value) : null;
              inlineEdit.setValue(numValue);
            }}
            placeholder={field.config?.placeholder}
            disabled={disabled}
            required={field.config?.required}
            autoFocus
            size="small"
            fullWidth
          />
        );

      case "slider":
        const sliderValue = typeof currentValue === "number" ? currentValue : (field.config?.min ?? 0);
        return (
          <Box>
            <Slider
              value={sliderValue}
              onChange={(_, newValue) => inlineEdit.setValue(newValue as number)}
              min={field.config?.min ?? 0}
              max={field.config?.max ?? 100}
              step={field.config?.step ?? 1}
              disabled={disabled}
              size="small"
            />
            <Typography variant="caption" sx={{ mt: 0.5, display: "block", textAlign: "center" }}>
              {sliderValue}
            </Typography>
          </Box>
        );

      case "select":
        return (
          <FormControl fullWidth size="small">
            {!inline && <InputLabel>{field.label}</InputLabel>}
            <Select
              inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
              value={currentValue ?? ""}
              onChange={(e) => inlineEdit.setValue(e.target.value || null)}
              disabled={disabled}
              required={field.config?.required}
              autoFocus
              label={!inline ? field.label : undefined}
            >
              <MenuItem value="">
                <em>—</em>
              </MenuItem>
              {field.config?.options?.map((opt) => (
                <MenuItem key={String(opt.value)} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case "boolean":
        return (
          <Checkbox
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            checked={currentValue ?? false}
            onChange={(e) => inlineEdit.setValue(e.target.checked)}
            disabled={disabled}
            autoFocus
          />
        );

      case "date":
        return (
          <TextField
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={currentValue ? new Date(currentValue).toISOString().split("T")[0] : ""}
            onChange={(e) => {
              const dateValue = e.target.value ? new Date(e.target.value).toISOString() : null;
              inlineEdit.setValue(dateValue);
            }}
            disabled={disabled}
            required={field.config?.required}
            autoFocus
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        );

      default:
        return <div>Unsupported field type: {field.type}</div>;
    }
  };

  // Start editing when inlineEdit value changes and we're in edit mode
  useEffect(() => {
    if (editing && !inlineEdit.hasChanges) {
      // Reset editing state if changes are discarded
    }
  }, [editing, inlineEdit.hasChanges]);

  // Inline-Edit Mode
  if (inline) {
    if (editing) {
      return (
        <Box ref={fieldRef} sx={{ position: "relative" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ flex: 1 }}>{renderFieldInput()}</Box>
          </Box>
          {inlineEdit.hasChanges && (
            <UdgGlassInlineEditControls
              hasChanges={inlineEdit.hasChanges}
              onSave={handleSave}
              onDiscard={handleCancel}
              anchorElement={fieldRef.current}
              position="bottom"
            />
          )}
        </Box>
      );
    } else {
      // Display mode
      let displayValue: React.ReactNode = value ?? null;
      
      // Format display value based on type
      if (field.type === "select" && value) {
        const option = field.config?.options?.find(opt => opt.value === value);
        displayValue = option ? option.label : value;
      } else if (field.type === "boolean") {
        displayValue = value ? "Yes" : "No";
      } else if (field.type === "slider" && typeof value === "number") {
        displayValue = value;
      } else if (field.type === "date" && value) {
        displayValue = new Date(value).toLocaleDateString();
      }

      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            {displayValue !== null && displayValue !== undefined && displayValue !== "" ? (
              <Typography variant="body2">{String(displayValue)}</Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                —
              </Typography>
            )}
          </Box>
          {!disabled && (
            <Box
              component="button"
              onClick={() => {
                inlineEdit.sync();
                setEditing(true);
              }}
              sx={{
                cursor: "pointer",
                opacity: 0.6,
                "&:hover": { opacity: 1 },
                border: "none",
                background: "transparent",
                padding: 0,
                display: "flex",
                alignItems: "center"
              }}
              aria-label="Edit field"
            >
              <MaterialSymbol icon="edit" fontSize={16} />
            </Box>
          )}
        </Box>
      );
    }
  }

  // Form Mode (for create flows)
  return (
    <Box>
      <Typography variant="caption" sx={{ mb: 0.5, display: "block" }}>
        {field.label}
        {field.config?.required && (
          <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>
            *
          </Typography>
        )}
      </Typography>
      {renderFieldInput()}
    </Box>
  );
};

