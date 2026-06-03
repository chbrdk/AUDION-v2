"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { FieldDefinition } from "@msqdx-glass/types";
import { Typography, Box, Checkbox, Tooltip } from "@mui/material";
import { MsqdxIcon, MsqdxSelect, MsqdxFormField, MsqdxTextareaField, MsqdxSlider } from "@msqdx/react";
import { MsqdxGlassEditButton } from "./msqdx-glass-edit-button";
import { useInlineEdit } from "../hooks/use-inline-edit";
import { MsqdxGlassInlineEditControls } from "../msqdx-glass-inline-edit-controls";
import { FORM_FIELD_ACCENT_SX, THEME_ACCENT } from "../../lib/theme-accent";
import { useI18n } from "../i18n/i18n-provider";

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
  /** Always show inputs (no click-to-edit); save snackbar appears when the value changes. */
  alwaysEditMode?: boolean;
  saving?: boolean;
  /**
   * Pass stable entity/selection id (e.g. `selectedId` or `profile.id`) so background detail refreshes
   * do not reset the inline value while the user is editing.
   */
  valueSyncKey?: string;
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
  alwaysEditMode = false,
  saving = false,
  valueSyncKey,
}: MsqdxGlassFieldEditorProps) => {
  const { t } = useI18n();
  const [editing, setEditing] = useState(forceEditMode || alwaysEditMode);

  const resolveLabel = (key: string | undefined, fallback: string) => {
    if (!key) return fallback;
    const v = t(key);
    return v === key ? fallback : v;
  };

  const fieldLabel = resolveLabel(field.labelKey, field.label);

  const resolveOptionLabel = (opt: { label: string; labelKey?: string }) =>
    resolveLabel(opt.labelKey, opt.label);

  // Update editing state when forceEditMode changes
  useEffect(() => {
    if (forceEditMode || alwaysEditMode) {
      setEditing(true);
      onEditStart?.();
    }
  }, [forceEditMode, alwaysEditMode, onEditStart]);
  const fieldRef = useRef<HTMLDivElement>(null);

  const inlineEdit = useInlineEdit({
    initialValue: value ?? (field.type === "boolean" ? false : null),
    currentValue: value ?? (field.type === "boolean" ? false : null),
    baselineKey: valueSyncKey,
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

  const setFieldValue = useCallback(
    (next: unknown) => {
      inlineEdit.setValue(next);
      if (alwaysEditMode) {
        onChange(field.key, next);
      }
    },
    [alwaysEditMode, field.key, inlineEdit, onChange]
  );

  const handleSave = useCallback(async () => {
    if (onSave) {
      try {
        await onSave(field.key, inlineEdit.getValue());
        onChange(field.key, inlineEdit.getValue());
        if (alwaysEditMode) {
          setTimeout(() => {
            inlineEdit.sync();
          }, 100);
        } else {
          setEditing(false);
          onEditEnd?.();
        }
      } catch (error) {
        console.error(`Save failed for field ${field.key}:`, error);
        throw error;
      }
    } else {
      onChange(field.key, inlineEdit.getValue());
      if (!alwaysEditMode) {
        setEditing(false);
        onEditEnd?.();
      }
    }
  }, [field.key, inlineEdit, onChange, onSave, onEditEnd, alwaysEditMode]);

  const handleCancel = useCallback(() => {
    inlineEdit.reset();
    if (!alwaysEditMode) {
      setEditing(false);
      onEditEnd?.();
    }
  }, [inlineEdit, onEditEnd, alwaysEditMode]);

  // Render field input based on type
  const renderFieldInput = () => {
    const currentValue = inlineEdit.value ?? (field.type === "boolean" ? false : null);
    const showFieldLabel = !inline || alwaysEditMode;

    switch (field.type) {
      case "text":
        return (
          <MsqdxFormField
            label={showFieldLabel ? fieldLabel : ""}
            value={currentValue ?? ""}
            onChange={(e) => setFieldValue(e.target.value || null)}
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            placeholder={field.config?.placeholder}
            disabled={disabled}
            required={field.config?.required}
            autoFocus={!alwaysEditMode}
            fullWidth
            sx={FORM_FIELD_ACCENT_SX}
          />
        );

      case "textarea":
        return (
          <MsqdxTextareaField
            label={showFieldLabel ? fieldLabel : ""}
            value={currentValue ?? ""}
            onChange={(e) => setFieldValue(e.target.value || null)}
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            placeholder={field.config?.placeholder}
            disabled={disabled}
            required={field.config?.required}
            autoFocus={!alwaysEditMode}
            fullWidth
            minRows={3}
            size="small"
            sx={FORM_FIELD_ACCENT_SX}
          />
        );

      case "number":
        return (
          <MsqdxFormField
            label={showFieldLabel ? fieldLabel : ""}
            type="number"
            value={currentValue ?? ""}
            onChange={(e) => {
              const numValue = e.target.value ? Number(e.target.value) : null;
              setFieldValue(numValue);
            }}
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            placeholder={field.config?.placeholder}
            disabled={disabled}
            required={field.config?.required}
            autoFocus={!alwaysEditMode}
            fullWidth
            sx={FORM_FIELD_ACCENT_SX}
          />
        );

      case "slider": {
        const sliderValue = typeof currentValue === "number" ? currentValue : (field.config?.min ?? 0);
        const sliderInner = (
          <Box>
            {/* @ts-expect-error MsqdxSlider ForwardRef type conflicts with React 19 inference */}
            <MsqdxSlider
              value={sliderValue}
              onChange={(_, newValue) => setFieldValue(Array.isArray(newValue) ? newValue[0] : newValue)}
              min={field.config?.min ?? 0}
              max={field.config?.max ?? 100}
              step={field.config?.step ?? 1}
              disabled={disabled}
              size="small"
              sx={{ color: THEME_ACCENT.color }}
              valueLabelDisplay="on"
            />
          </Box>
        );
        if (field.key === "media_affinity") {
          return (
            <Tooltip title={t("entityEditor.mediaAffinityHint")} arrow>
              <Box>{sliderInner}</Box>
            </Tooltip>
          );
        }
        return sliderInner;
      }

      case "select": {
        const options = field.config?.options ?? [];
        const selectOptions = [
          { value: "" as const, label: t("common.notSpecified") },
          ...options.map((opt) => ({ value: opt.value, label: resolveOptionLabel(opt) })),
        ];
        return (
          <MsqdxSelect
            label={showFieldLabel ? fieldLabel : ""}
            options={selectOptions}
            value={currentValue ?? ""}
            onChange={(e) => setFieldValue(e.target.value || null)}
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            disabled={disabled}
            required={field.config?.required}
            autoFocus={!alwaysEditMode}
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
            onChange={(e) => setFieldValue(e.target.checked)}
            disabled={disabled}
            autoFocus={!alwaysEditMode}
          />
        );

      case "date":
        return (
          <MsqdxFormField
            label={showFieldLabel ? fieldLabel : ""}
            type="date"
            value={currentValue ? new Date(currentValue).toISOString().split("T")[0] : ""}
            onChange={(e) => {
              const dateValue = e.target.value ? new Date(e.target.value).toISOString() : null;
              setFieldValue(dateValue);
            }}
            inputRef={inlineEdit.elementRef as React.RefObject<HTMLInputElement>}
            disabled={disabled}
            required={field.config?.required}
            autoFocus={!alwaysEditMode}
            fullWidth
            sx={FORM_FIELD_ACCENT_SX}
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

  // Always-visible inputs (e.g. TG v2 basics)
  if (alwaysEditMode) {
    return (
      <Box ref={fieldRef} sx={{ position: "relative" }}>
        {renderFieldInput()}
        <MsqdxGlassInlineEditControls
          hasChanges={inlineEdit.hasChanges}
          saving={saving}
          onSave={handleSave}
          onDiscard={handleCancel}
          anchorElement={fieldRef.current}
          position="bottom"
        />
      </Box>
    );
  }

  // Inline-Edit Mode
  if (inline) {
    if (editing) {
      return (
        <Box ref={fieldRef} sx={{ position: "relative" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ flex: 1 }}>{renderFieldInput()}</Box>
          </Box>
          <MsqdxGlassInlineEditControls
            hasChanges={inlineEdit.hasChanges}
            saving={saving}
            onSave={handleSave}
            onDiscard={handleCancel}
            anchorElement={fieldRef.current}
            position="bottom"
          />
        </Box>
      );
    } else {
      // Display mode
      let displayValue: React.ReactNode = value ?? null;

      // Format display value based on type
      if (field.type === "select" && value) {
        const option = field.config?.options?.find(opt => opt.value === value);
        displayValue = option ? resolveOptionLabel(option) : value;
      } else if (field.type === "boolean") {
        displayValue = value ? t("common.yes") : t("common.no");
      } else if (field.type === "slider" && typeof value === "number") {
        displayValue =
          field.key === "media_affinity" || (field.config?.max === 100 && field.config?.min === 0)
            ? `${value}%`
            : value;
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
                {t("common.notSpecified")}
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
              aria-label={`${t("common.edit")} ${fieldLabel}`}
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
        {fieldLabel}
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

