"use client";

import type { MutableRefObject } from "react";
import type { Locale } from "../../lib/i18n";
import type { PersonaResponse } from "@msqdx-glass/types";
import { getFieldDefinitions } from "@msqdx-glass/types";
import { Box, IconButton, TextField, Tooltip } from "@mui/material";
import { MsqdxButton, MsqdxIcon } from "@msqdx/react";
import { mirrorFillStringPair } from "../../lib/bilingual-mirror";
import {
  PERSONA_BASICS_HERO_AVATAR_ICON_SIZE,
} from "../../lib/persona-basics-hero-layout";
import { safePersonaAvatarSrc } from "../../lib/persona-avatar-src";
import { translatePersonaAdminFields } from "../../lib/persona-translate-fields";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassEditButton, MsqdxGlassFieldEditor } from "../generic";
import {
  MsqdxGlassPersonaMetadataAssignment,
  type PersonaMetadataAssignmentProject,
  type PersonaMetadataAssignmentTargetGroup,
} from "./msqdx-glass-persona-metadata-assignment";

export type PersonaBasicsHeroEditForm = {
  headline: string;
  headline_de: string;
};

export type MsqdxGlassPersonaBasicsHeroProps = {
  detail: PersonaResponse;
  selectedId: string | null;
  locale: Locale;
  editForm: PersonaBasicsHeroEditForm;
  onEditFormPatch: (patch: Partial<PersonaBasicsHeroEditForm>) => void;
  editingField: string | null;
  setEditingField: (field: string | null) => void;
  metadataFormDirtyRef: MutableRefObject<boolean>;
  savePending: boolean;
  enrichPending: boolean;
  avatarGeneratePending: boolean;
  metadataAssignPending: boolean;
  projects: readonly PersonaMetadataAssignmentProject[];
  targetGroups: readonly PersonaMetadataAssignmentTargetGroup[];
  onSave: (updates: Record<string, unknown>) => Promise<void>;
  onAssignMetadata: (payload: { project_id?: string; target_group_id?: string }) => void | Promise<void>;
  onEnrichWithAi: () => void;
  onGenerateAvatar: () => void;
  onArchive: () => void;
  onDelete: () => void;
  notify: (message: string) => void;
};

export function MsqdxGlassPersonaBasicsHero({
  detail,
  selectedId,
  locale,
  editForm,
  onEditFormPatch,
  editingField,
  setEditingField,
  metadataFormDirtyRef,
  savePending,
  enrichPending,
  avatarGeneratePending,
  metadataAssignPending,
  projects,
  targetGroups,
  onSave,
  onAssignMetadata,
  onEnrichWithAi,
  onGenerateAvatar,
  onArchive,
  onDelete,
  notify,
}: MsqdxGlassPersonaBasicsHeroProps) {
  const { t } = useI18n();
  const fieldDefinitions = getFieldDefinitions("persona");
  const nameField = fieldDefinitions.find((f) => f.key === "name");
  const segmentField = fieldDefinitions.find((f) => f.key === "segment");

  const handleFieldSave = async (key: string, value: unknown) => {
    await onSave({ [key]: value });
    setEditingField(null);
  };

  const headlineDisplay =
    locale === "de"
      ? detail.headline_de?.trim() || detail.profile.headline || "—"
      : detail.profile.headline || "—";

  const avatarSrc =
    safePersonaAvatarSrc(detail.metadata.avatarUrl, detail.metadata.personaId) ??
    detail.metadata.avatarUrl;

  return (
    <div className="msqdx-glass-persona-basics-hero">
      <div className="msqdx-glass-persona-basics-hero__media">
        <div className="msqdx-glass-persona-basics-hero__avatar" aria-hidden={!avatarSrc}>
          {avatarSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatarSrc} alt={`${detail.profile.name} Avatar`} />
          ) : (
            <MsqdxIcon name="person" customSize={PERSONA_BASICS_HERO_AVATAR_ICON_SIZE} />
          )}
        </div>
        <MsqdxButton
          className="msqdx-glass-persona-basics-hero__avatar-action"
          variant="outlined"
          size="small"
          fullWidth
          onClick={onGenerateAvatar}
          disabled={avatarGeneratePending || savePending}
          startIcon={<MsqdxIcon name="photo_camera" customSize={16} />}
        >
          {avatarGeneratePending ? t("personaAdmin.generatingAvatar") : t("personaAdmin.generateAvatar")}
        </MsqdxButton>
      </div>

      <div className="msqdx-glass-persona-basics-hero__body">
        <div className="msqdx-glass-persona-basics-hero__identity">
          {nameField ? (
            <div className="msqdx-glass-persona-basics-hero__name-row">
              {editingField === "name" ? (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <MsqdxGlassFieldEditor
                    field={nameField}
                    value={detail.profile.name}
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
                  <h2 className="msqdx-glass-persona-basics-hero__name">{detail.profile.name}</h2>
                  <MsqdxGlassEditButton
                    onClick={() => setEditingField("name")}
                    disabled={savePending}
                    aria-label="Edit name"
                    size="small"
                    fontSize={16}
                  />
                </>
              )}
            </div>
          ) : null}

          <div className="msqdx-glass-persona-basics-hero__headline-row">
            {editingField === "headline" ? (
              <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  label={t("personaAdmin.headline")}
                  value={locale === "de" ? editForm.headline_de : editForm.headline}
                  onChange={(e) => {
                    metadataFormDirtyRef.current = true;
                    if (locale === "de") {
                      onEditFormPatch({ headline_de: e.target.value });
                    } else {
                      onEditFormPatch({ headline: e.target.value });
                    }
                  }}
                  placeholder={t("personaAdmin.headlinePlaceholder")}
                  disabled={savePending}
                />
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <MsqdxButton
                    variant="outlined"
                    size="small"
                    disabled={savePending}
                    onClick={() => {
                      metadataFormDirtyRef.current = false;
                      onEditFormPatch({
                        headline: detail.profile.headline,
                        headline_de: detail.headline_de ?? "",
                      });
                      setEditingField(null);
                    }}
                  >
                    {t("common.cancel")}
                  </MsqdxButton>
                  <MsqdxButton
                    variant="contained"
                    size="small"
                    disabled={savePending}
                    onClick={async () => {
                      if (!selectedId) return;
                      try {
                        const raw =
                          locale === "de" ? editForm.headline_de.trim() : editForm.headline.trim();
                        let headlineEn = editForm.headline.trim();
                        let headlineDe = editForm.headline_de.trim();
                        if (raw) {
                          try {
                            const { strings } = await translatePersonaAdminFields(selectedId, {
                              fromLocale: locale,
                              strings: { headline: raw },
                            });
                            const translated = strings.headline?.trim() ?? "";
                            if (locale === "de") {
                              headlineDe = raw;
                              headlineEn =
                                translated || mirrorFillStringPair("", raw).en || headlineEn;
                            } else {
                              headlineEn = raw;
                              headlineDe =
                                translated || mirrorFillStringPair(raw, "").de || headlineDe;
                            }
                          } catch {
                            const p = mirrorFillStringPair(
                              locale === "de" ? headlineEn : raw,
                              locale === "de" ? raw : headlineDe
                            );
                            headlineEn = p.en;
                            headlineDe = p.de;
                          }
                        } else {
                          const p = mirrorFillStringPair(editForm.headline, editForm.headline_de);
                          headlineEn = p.en.trim();
                          headlineDe = p.de.trim();
                        }
                        await onSave({ headline: headlineEn, headline_de: headlineDe });
                        setEditingField(null);
                      } catch (e) {
                        notify(e instanceof Error ? e.message : t("personaAdmin.toasts.saveFailed"));
                      }
                    }}
                  >
                    {t("common.save")}
                  </MsqdxButton>
                </Box>
              </Box>
            ) : (
              <>
                <p className="msqdx-glass-persona-basics-hero__headline">{headlineDisplay}</p>
                <MsqdxGlassEditButton
                  onClick={() => setEditingField("headline")}
                  disabled={savePending}
                  aria-label="Edit headline"
                  size="small"
                  fontSize={14}
                />
              </>
            )}
          </div>

          {segmentField ? (
            <div className="msqdx-glass-persona-basics-hero__segment-row">
              {editingField === "segment" ? (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <MsqdxGlassFieldEditor
                    field={segmentField}
                    value={detail.profile.segment}
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
                    {detail.profile.segment || "—"}
                  </span>
                  <MsqdxGlassEditButton
                    onClick={() => setEditingField("segment")}
                    disabled={savePending}
                    aria-label="Edit segment"
                    size="small"
                    fontSize={14}
                  />
                </>
              )}
            </div>
          ) : null}
        </div>

        <MsqdxGlassPersonaMetadataAssignment
          detail={detail}
          projects={projects}
          targetGroups={targetGroups}
          disabled={metadataAssignPending || savePending}
          onAssign={onAssignMetadata}
        />

        <div className="msqdx-glass-persona-basics-hero__toolbar">
          <MsqdxButton
            variant="contained"
            size="small"
            onClick={onEnrichWithAi}
            disabled={enrichPending || savePending}
            startIcon={<MsqdxIcon name="auto_awesome" customSize={16} />}
          >
            {enrichPending ? t("personaAdmin.enrichingWithAi") : t("personaAdmin.enrichWithAi")}
          </MsqdxButton>
          <div className="msqdx-glass-persona-basics-hero__toolbar-actions">
            <Tooltip title={t("personaAdmin.archive")}>
              <span>
                <IconButton
                  size="small"
                  onClick={onArchive}
                  disabled={savePending}
                  aria-label={t("personaAdmin.archive")}
                  className="msqdx-glass-persona-basics-hero__icon-action"
                >
                  <MsqdxIcon name="archive" customSize={18} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t("personaAdmin.deletePersona")}>
              <span>
                <IconButton
                  size="small"
                  onClick={onDelete}
                  disabled={savePending}
                  aria-label={t("personaAdmin.deletePersona")}
                  className="msqdx-glass-persona-basics-hero__icon-action msqdx-glass-persona-basics-hero__icon-action--danger"
                >
                  <MsqdxIcon name="delete" customSize={18} />
                </IconButton>
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
