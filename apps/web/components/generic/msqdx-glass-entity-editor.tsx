"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { Box, Typography, Stack, Divider } from "@mui/material";
import type { FieldDefinition, getFieldDefinitions, groupFields } from "@msqdx-glass/types";
import { getFieldDefinitions as getFieldDefs, groupFields as groupFieldsHelper } from "@msqdx-glass/types";
import { MsqdxGlassFieldEditor } from "./msqdx-glass-field-editor";
import { useI18n } from "../i18n/i18n-provider";
import { entityFieldGroupTitleKey } from "../../lib/entity-field-i18n";

export type MsqdxGlassEntityEditorProps<T extends Record<string, any>> = {
  entityType: "persona" | "targetGroup" | "document" | "knowledge";
  entity: T;
  /**
   * When this value stays stable, in-memory field edits are preserved across parent re-renders
   * (e.g. background detail refresh with a new object reference). Use the selected entity id
   * (`selectedId`); avoid tying to `updatedAt` or every save would reset other unsaved fields.
   */
  entitySyncKey?: string;
  onSave: (updates: Partial<T>) => Promise<void>;
  fieldOverrides?: Partial<Record<string, FieldDefinition>>; // Für Entity-spezifische Overrides
  inline?: boolean;
  disabled?: boolean;
  showGroups?: boolean; // Zeige Gruppierung an
  /** Always show inputs; save snackbar on change (TG v2 basics). */
  alwaysEditMode?: boolean;
  savePending?: boolean;
};

/**
 * Generische Entität-Editor Komponente.
 * Lädt Feld-Definitionen für eine Entität und rendert Edit-Komponenten für alle Felder.
 */
export const MsqdxGlassEntityEditor = <T extends Record<string, any>>({
  entityType,
  entity,
  entitySyncKey = "",
  onSave,
  fieldOverrides = {},
  inline = true,
  disabled = false,
  showGroups = true,
  alwaysEditMode = false,
  savePending = false,
}: MsqdxGlassEntityEditorProps<T>) => {
  const { t } = useI18n();
  const [localEntity, setLocalEntity] = useState<T>(entity);
  const [pendingUpdates, setPendingUpdates] = useState<Partial<T>>({});
  const [saving, setSaving] = useState(false);
  const entityRef = useRef(entity);
  entityRef.current = entity;

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

  // Sync only when the server revision changes — not when `entity` is a new object with the same data
  // (otherwise background detail polling wipes sliders and other unsaved edits).
  useEffect(() => {
    setLocalEntity(entityRef.current);
    setPendingUpdates({});
  }, [entitySyncKey]);

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
  const resolveGroupHeading = (groupName: string) => {
    const path = entityFieldGroupTitleKey(groupName);
    const label = t(path);
    return label === path ? groupName : label;
  };

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
              {resolveGroupHeading(groupName)}
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </>
        )}
        <Stack spacing={2}>
          {groupFields.map((field) => {
            const path = field.labelKey;
            const columnLabel = path ? (() => {
              const v = t(path);
              return v === path ? field.label : v;
            })() : field.label;
            return (
            <Box key={field.key}>
              {inline && !alwaysEditMode ? (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      minWidth: "150px",
                      fontWeight: 500,
                      pt: 1,
                    }}
                  >
                    {columnLabel}
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <MsqdxGlassFieldEditor
                      field={field}
                      value={localEntity[field.key]}
                      onChange={handleFieldChange}
                      onSave={handleFieldSave}
                      inline={inline}
                      disabled={disabled}
                      alwaysEditMode={alwaysEditMode}
                      saving={savePending || saving}
                      valueSyncKey={entitySyncKey || undefined}
                    />
                  </Box>
                </Box>
              ) : (
                <MsqdxGlassFieldEditor
                  field={field}
                  value={localEntity[field.key]}
                  onChange={handleFieldChange}
                  onSave={handleFieldSave}
                  inline={false}
                  disabled={disabled}
                  alwaysEditMode={alwaysEditMode}
                  saving={savePending || saving}
                  valueSyncKey={entitySyncKey || undefined}
                />
              )}
            </Box>
            );
          })}
        </Stack>
      </Box>
    ));
  };

  return (
    <Box className="msqdx-glass-entity-editor">
      {renderGroupedFields()}

      {/* Bulk Save Button (if multiple changes pending) */}
      {Object.keys(pendingUpdates).length > 1 && (
        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <button
            className="msqdx-glass-button"
            onClick={handleBulkSave}
            disabled={saving}
            style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
          >
            {t("entityEditor.saveAllChanges", { count: Object.keys(pendingUpdates).length })}
          </button>
        </Box>
      )}
    </Box>
  );
};

