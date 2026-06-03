"use client";

import type { TargetGroupResponse } from "@msqdx-glass/types";
import { getFieldDefinitions } from "@msqdx-glass/types";
import { Box } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";
import {
  TARGET_GROUP_BASICS_HERO_ICON_INNER_SIZE,
} from "../../lib/target-group-basics-hero-layout";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassEditButton, MsqdxGlassFieldEditor } from "../generic";

export type MsqdxGlassTargetGroupBasicsHeroProps = {
  detail: TargetGroupResponse;
  selectedId: string | null;
  editingField: string | null;
  setEditingField: (field: string | null) => void;
  savePending: boolean;
  onSave: (updates: Record<string, unknown>) => Promise<void>;
  formatDate: (value?: string | null) => string;
};

export function MsqdxGlassTargetGroupBasicsHero({
  detail,
  selectedId,
  editingField,
  setEditingField,
  savePending,
  onSave,
  formatDate,
}: MsqdxGlassTargetGroupBasicsHeroProps) {
  const { t } = useI18n();
  const fieldDefinitions = getFieldDefinitions("targetGroup");
  const nameField = fieldDefinitions.find((f) => f.key === "name");
  const segmentField = fieldDefinitions.find((f) => f.key === "segment");
  const statusField = fieldDefinitions.find((f) => f.key === "status");

  const handleFieldSave = async (key: string, value: unknown) => {
    await onSave({ [key]: value });
    setEditingField(null);
  };

  const statusValue = detail.status ?? "draft";
  const statusLabel =
    statusValue === "published"
      ? t("targetGroupsAdmin.statusPublished")
      : t("targetGroupsAdmin.statusDraft");

  const projectId = detail.projectId ?? (detail as { project_id?: string }).project_id ?? "—";
  const createdAt = detail.createdAt ?? (detail as { created_at?: string }).created_at ?? "";
  const updatedAt = detail.updatedAt ?? (detail as { updated_at?: string }).updated_at ?? "";

  return (
    <div className="msqdx-glass-persona-basics-hero msqdx-glass-target-group-basics-hero">
      <div className="msqdx-glass-persona-basics-hero__media">
        <div className="msqdx-glass-persona-basics-hero__avatar" aria-hidden>
          <MsqdxIcon name="groups" customSize={TARGET_GROUP_BASICS_HERO_ICON_INNER_SIZE} />
        </div>
      </div>

      <div className="msqdx-glass-persona-basics-hero__body">
        <div className="msqdx-glass-persona-basics-hero__identity">
          {nameField ? (
            <div className="msqdx-glass-persona-basics-hero__name-row">
              {editingField === "name" ? (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <MsqdxGlassFieldEditor
                    field={nameField}
                    value={detail.name}
                    valueSyncKey={selectedId || undefined}
                    onChange={() => {}}
                    onSave={(k, v) => handleFieldSave(k, v)}
                    inline
                    disabled={savePending}
                    forceEditMode
                    onEditEnd={() => setEditingField(null)}
                  />
                </Box>
              ) : (
                <>
                  <h2 className="msqdx-glass-persona-basics-hero__name">{detail.name || "—"}</h2>
                  <MsqdxGlassEditButton
                    onClick={() => setEditingField("name")}
                    disabled={savePending}
                    aria-label={t("targetGroupsAdmin.name")}
                    size="small"
                    fontSize={16}
                  />
                </>
              )}
            </div>
          ) : null}

          {segmentField ? (
            <div className="msqdx-glass-persona-basics-hero__segment-row">
              {editingField === "segment" ? (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <MsqdxGlassFieldEditor
                    field={segmentField}
                    value={detail.segment}
                    valueSyncKey={selectedId || undefined}
                    onChange={() => {}}
                    onSave={(k, v) => handleFieldSave(k, v)}
                    inline
                    disabled={savePending}
                    forceEditMode
                    onEditEnd={() => setEditingField(null)}
                  />
                </Box>
              ) : (
                <>
                  <span className="msqdx-glass-persona-basics-hero__segment-pill">
                    {detail.segment || "—"}
                  </span>
                  <MsqdxGlassEditButton
                    onClick={() => setEditingField("segment")}
                    disabled={savePending}
                    aria-label={t("targetGroupsAdmin.segment")}
                    size="small"
                    fontSize={14}
                  />
                </>
              )}
            </div>
          ) : null}

          {statusField ? (
            <div className="msqdx-glass-target-group-basics-hero__status-row">
              {editingField === "status" ? (
                <Box sx={{ flex: 1, minWidth: 0, maxWidth: 280 }}>
                  <MsqdxGlassFieldEditor
                    field={statusField}
                    value={statusValue}
                    valueSyncKey={selectedId || undefined}
                    onChange={() => {}}
                    onSave={(k, v) => handleFieldSave(k, v)}
                    inline
                    disabled={savePending}
                    forceEditMode
                    onEditEnd={() => setEditingField(null)}
                  />
                </Box>
              ) : (
                <>
                  <span
                    className={`msqdx-glass-target-group-basics-hero__status-pill msqdx-glass-target-group-basics-hero__status-pill--${statusValue}`}
                  >
                    {statusLabel}
                  </span>
                  <MsqdxGlassEditButton
                    onClick={() => setEditingField("status")}
                    disabled={savePending}
                    aria-label={t("targetGroupsAdmin.publicationStatus")}
                    size="small"
                    fontSize={14}
                  />
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="msqdx-glass-target-group-basics-hero__metadata">
          <div className="msqdx-glass-target-group-basics-hero__metadata-item">
            <span className="msqdx-glass-target-group-basics-hero__metadata-label">
              {t("targetGroupsAdmin.projectId")}
            </span>
            <span className="msqdx-glass-target-group-basics-hero__metadata-value">{projectId}</span>
          </div>
          <div className="msqdx-glass-target-group-basics-hero__metadata-item">
            <span className="msqdx-glass-target-group-basics-hero__metadata-label">
              {t("targetGroupsAdmin.created")}
            </span>
            <span className="msqdx-glass-target-group-basics-hero__metadata-value">
              {formatDate(createdAt)}
            </span>
          </div>
          <div className="msqdx-glass-target-group-basics-hero__metadata-item">
            <span className="msqdx-glass-target-group-basics-hero__metadata-label">
              {t("targetGroupsAdmin.updated")}
            </span>
            <span className="msqdx-glass-target-group-basics-hero__metadata-value">
              {formatDate(updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
