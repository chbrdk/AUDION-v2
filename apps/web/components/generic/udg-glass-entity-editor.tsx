"use client";

import { useCallback, useState, useEffect } from "react";
import { Box, Typography, Stack, Divider } from "@mui/material";
import type { FieldDefinition, getFieldDefinitions, groupFields } from "@udg-glass/types";
import { getFieldDefinitions as getFieldDefs, groupFields as groupFieldsHelper } from "@udg-glass/types";
import { UdgGlassFieldEditor } from "./udg-glass-field-editor";

export type UdgGlassEntityEditorProps<T extends Record<string, any>> = {
  entityType: "persona" | "targetGroup" | "document" | "knowledge";
  entity: T;
  onSave: (updates: Partial<T>) => Promise<void>;
  fieldOverrides?: Partial<Record<string, FieldDefinition>>; // Für Entity-spezifische Overrides
  inline?: boolean;
  disabled?: boolean;
  showGroups?: boolean; // Zeige Gruppierung an
};

/**
 * Generische Entität-Editor Komponente.
 * Lädt Feld-Definitionen für eine Entität und rendert Edit-Komponenten für alle Felder.
 */
export const UdgGlassEntityEditor = <T extends Record<string, any>>({
  entityType,
  entity,
  onSave,
  fieldOverrides = {},
  inline = true,
  disabled = false,
  showGroups = true,
}: UdgGlassEntityEditorProps<T>) => {
  const [localEntity, setLocalEntity] = useState<T>(entity);
  const [pendingUpdates, setPendingUpdates] = useState<Partial<T>>({});
  const [saving, setSaving] = useState(false);

  // Load field definitions
  const fieldDefinitions = getFieldDefs(entityType);

  // Apply overrides and filter out undefined fields
  const fields = fieldDefinitions
    .map((field) => {
      const override = fieldOverrides[field.key];
      if (override === undefined && fieldOverrides.hasOwnProperty(field.key)) {
        // Field is explicitly set to undefined in overrides, exclude it
        return null;
      }
      return {
        ...field,
        ...(override || {}),
      };
    })
    .filter((field): field is FieldDefinition => field !== null);

  // Group fields
  const groupedFields = showGroups ? groupFieldsHelper(fields) : { all: fields };

  // Sync local entity when external entity changes
  useEffect(() => {
    setLocalEntity(entity);
    setPendingUpdates({});
  }, [entity]);

  const handleFieldChange = useCallback(
    (key: string, value: any) => {
      setLocalEntity((prev) => ({ ...prev, [key]: value }));
      setPendingUpdates((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleFieldSave = useCallback(
    async (key: string, value: any) => {
      try {
        await onSave({ [key]: value } as Partial<T>);
        setPendingUpdates((prev) => {
          const next = { ...prev };
          delete next[key as keyof T];
          return next;
        });
        // Update local entity after successful save
        setLocalEntity((prev) => ({ ...prev, [key]: value }));
      } catch (error) {
        console.error(`Save failed for field ${key}:`, error);
        throw error;
      }
    },
    [onSave]
  );

  const handleBulkSave = useCallback(async () => {
    if (Object.keys(pendingUpdates).length === 0) {
      return;
    }

    setSaving(true);
    try {
      await onSave(pendingUpdates);
      setPendingUpdates({});
    } catch (error) {
      console.error("Bulk save failed:", error);
    } finally {
      setSaving(false);
    }
  }, [pendingUpdates, onSave]);

  // Render grouped fields
  const renderGroupedFields = () => {
    return Object.entries(groupedFields).map(([groupName, groupFields]) => (
      <Box key={groupName} sx={{ mb: 3 }}>
        {showGroups && groupName !== "all" && (
          <>
            <Typography
              variant="h6"
              sx={{
                fontSize: "0.875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                mb: 2,
                color: "text.secondary",
              }}
            >
              {groupName}
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </>
        )}
        <Stack spacing={2}>
          {groupFields.map((field) => (
            <Box key={field.key}>
              {inline ? (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      minWidth: "150px",
                      fontWeight: 500,
                      pt: 1,
                    }}
                  >
                    {field.label}
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <UdgGlassFieldEditor
                      field={field}
                      value={localEntity[field.key]}
                      onChange={handleFieldChange}
                      onSave={handleFieldSave}
                      inline={inline}
                      disabled={disabled}
                    />
                  </Box>
                </Box>
              ) : (
                <UdgGlassFieldEditor
                  field={field}
                  value={localEntity[field.key]}
                  onChange={handleFieldChange}
                  onSave={handleFieldSave}
                  inline={false}
                  disabled={disabled}
                />
              )}
            </Box>
          ))}
        </Stack>
      </Box>
    ));
  };

  return (
    <Box className="udg-glass-entity-editor">
      {renderGroupedFields()}

      {/* Bulk Save Button (if multiple changes pending) */}
      {Object.keys(pendingUpdates).length > 1 && (
        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <button
            className="udg-glass-button"
            onClick={handleBulkSave}
            disabled={saving}
            style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
          >
            Save All Changes ({Object.keys(pendingUpdates).length})
          </button>
        </Box>
      )}
    </Box>
  );
};

