"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { FieldDefinition } from "@msqdx-glass/types";
import { Typography, Box, Checkbox } from "@mui/material";
import { MsqdxIcon, MsqdxSelect, MsqdxFormField, MsqdxTextareaField, MsqdxSlider } from "@msqdx/react";
import { MsqdxGlassEditButton } from "./msqdx-glass-edit-button";
import { useInlineEdit } from "../hooks/use-inline-edit";
import { MsqdxGlassInlineEditControls } from "../msqdx-glass-inline-edit-controls";

export type MsqdxGlassFieldEditorProps = {
  field: FieldDefinition;
  value: any;
  onChange: (key: string, value: any) => void;
  onSave?: (key: string, value: any) => Promise<void>;
  inline?: boolean;
  disabled?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  forceEditMode?: boolean;
};

/**
 * Generische Feld-Editor Komponente.
 * Unterstützt alle Feld-Typen (text, number, select, textarea, slider, date, boolean).
 */
export const MsqdxGlassFieldEditor = ({
  field,
  value,
  onChange,
  onSave,
  inline = true,
  disabled = false,
  onEditStart,
  onEditEnd,
  forceEditMode = false,
}: MsqdxGlassFieldEditorProps) => {
  const [editing, setEditing] = useState(forceEditMode);
  
  // Update editing state when forceEditMode changes
  useEffect(() => {
    if (forceEditMode) {
      setEditing(true);
      onEditStart?.();
    }
  }, [forceEditMode, onEditStart]);
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
        onEditEnd?.();
      } catch (error) {
        console.error(`Save failed for field ${field.key}:`, error);
        throw error;
      }
    } else {
      onChange(field.key, inlineEdit.getValue());
      setEditing(false);
      onEditEnd?.();
    }
  }, [field.key, inlineEdit, onChange, onSave, onEditEnd]);

  const handleCancel = useCallback(() => {
    inlineEdit.reset();
    setEditing(false);
    onEditEnd?.();
  }, [inlineEdit, onEditEnd]);

  // Render field input based on type
  const renderFieldInput = () => {
    const currentValue = inlineEdit.value ?? (field.type === "boolean" ? false : null);

    switch (field.type) {
      case "text":
        return (
          <MsqdxFormField
            label={inline ? "" : field.label}
            value={currentValue ?? ""}
            onChange={(e) => inlineEdit.setValue(e.target.value || null)}
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            placeholder={field.config?.placeholder}
            disabled={disabled}
            required={field.config?.required}
            autoFocus
            fullWidth
            borderColor="black"
          />
        );

      case "textarea":
        return (
          <MsqdxTextareaField
            label={inline ? "" : field.label}
            value={currentValue ?? ""}
            onChange={(e) => inlineEdit.setValue(e.target.value || null)}
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            placeholder={field.config?.placeholder}
            disabled={disabled}
            required={field.config?.required}
            autoFocus
            fullWidth
            minRows={3}
            size="small"
            borderColor="black"
          />
        );

      case "number":
        return (
          <MsqdxFormField
            label={inline ? "" : field.label}
            type="number"
            value={currentValue ?? ""}
            onChange={(e) => {
              const numValue = e.target.value ? Number(e.target.value) : null;
              inlineEdit.setValue(numValue);
            }}
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            placeholder={field.config?.placeholder}
            disabled={disabled}
            required={field.config?.required}
            autoFocus
            fullWidth
            borderColor="black"
          />
        );

      case "slider": {
        const sliderValue = typeof currentValue === "number" ? currentValue : (field.config?.min ?? 0);
        return (
          <Box>
            {/* @ts-expect-error MsqdxSlider ForwardRef type conflicts with React 19 inference */}
            <MsqdxSlider
              value={sliderValue}
              onChange={(_, newValue) => inlineEdit.setValue(Array.isArray(newValue) ? newValue[0] : newValue)}
              min={field.config?.min ?? 0}
              max={field.config?.max ?? 100}
              step={field.config?.step ?? 1}
              disabled={disabled}
              size="small"
              brandColor="black"
              valueLabelDisplay="on"
            />
          </Box>
        );
      }

      case "select": {
        const options = field.config?.options ?? [];
        const selectOptions = [
          { value: "" as const, label: "—" },
          ...options.map((opt) => ({ value: opt.value, label: opt.label })),
        ];
        return (
          <MsqdxSelect
            label={inline ? "" : field.label}
            options={selectOptions}
            value={currentValue ?? ""}
            onChange={(e) => inlineEdit.setValue(e.target.value || null)}
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            disabled={disabled}
            required={field.config?.required}
            autoFocus
            fullWidth
            size="small"
            displayEmpty
          />
        );
      }

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
          <MsqdxFormField
            label={inline ? "" : field.label}
            type="date"
            value={currentValue ? new Date(currentValue).toISOString().split("T")[0] : ""}
            onChange={(e) => {
              const dateValue = e.target.value ? new Date(e.target.value).toISOString() : null;
              inlineEdit.setValue(dateValue);
            }}
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            disabled={disabled}
            required={field.config?.required}
            autoFocus
            fullWidth
            borderColor="black"
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
            <MsqdxGlassInlineEditControls
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
            <MsqdxGlassEditButton
              onClick={() => {
                inlineEdit.sync();
                setEditing(true);
                onEditStart?.();
              }}
              aria-label={`Edit ${field.label}`}
              size="small"
              fontSize={16}
            />
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

