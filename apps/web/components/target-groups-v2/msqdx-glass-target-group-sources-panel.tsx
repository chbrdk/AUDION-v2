"use client";

import { useState, type FormEvent } from "react";
import { Box, Stack } from "@mui/material";
import type { PersonaDocument, TargetGroupKnowledgeEntry } from "@msqdx-glass/types";
import {
  MsqdxButton,
  MsqdxChip,
  MsqdxFormField,
  MsqdxIcon,
  MsqdxMoleculeCard,
  MsqdxTextareaField,
  MsqdxTypography,
} from "@msqdx/react";
import {
  documentIngestionChip,
  formatDocumentSize,
} from "../../lib/target-group-document-display";
import { FORM_FIELD_ACCENT_SX } from "../../lib/theme-accent";
import {
  TG_V2_SURFACE_CLASS,
  tgV2CardSurfaceSx,
  tgV2CreateSurfaceSx,
} from "../../lib/target-group-v2-surface-styles";
import { useI18n } from "../i18n/i18n-provider";
import { PersonaV2SectionBlock } from "../personas-v2/persona-v2-section-block";

export type MsqdxGlassTargetGroupSourcesPanelProps = {
  documents: PersonaDocument[];
  knowledgeEntries: TargetGroupKnowledgeEntry[];
  documentUploadPending: boolean;
  knowledgePending: boolean;
  documentsUpdating: boolean;
  onUploadClick: () => void;
  onDeleteKnowledge: (knowledgeId: string) => void;
  onAddKnowledge: (payload: { title: string; content: string }) => Promise<void>;
};

type KnowledgeFormState = {
  title: string;
  content: string;
};

const defaultKnowledgeForm: KnowledgeFormState = {
  title: "",
  content: "",
};

export function MsqdxGlassTargetGroupSourcesPanel({
  documents,
  knowledgeEntries,
  documentUploadPending,
  knowledgePending,
  documentsUpdating,
  onUploadClick,
  onDeleteKnowledge,
  onAddKnowledge,
}: MsqdxGlassTargetGroupSourcesPanelProps) {
  const { t } = useI18n();
  const accent = "var(--color-theme-accent)";
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormState>(defaultKnowledgeForm);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  const chipLabels = {
    indexed: t("targetGroupsAdmin.indexed"),
    processing: (progress: number) => t("targetGroupsAdmin.processing", { progress }),
    error: t("targetGroupsAdmin.error"),
    pending: t("targetGroupsAdmin.pending"),
  };

  const handleKnowledgeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!knowledgeForm.title.trim() || !knowledgeForm.content.trim()) {
      setKnowledgeError(t("targetGroupsAdmin.toasts.titleContentRequired"));
      return;
    }
    setKnowledgeError(null);
    try {
      await onAddKnowledge({
        title: knowledgeForm.title.trim(),
        content: knowledgeForm.content.trim(),
      });
      setKnowledgeForm(defaultKnowledgeForm);
      setShowAddKnowledge(false);
    } catch (e) {
      setKnowledgeError(e instanceof Error ? e.message : t("targetGroupsAdmin.toasts.knowledgeSaveFailed"));
    }
  };

  const documentsTitle = `${t("targetGroupV2.sources.documentsHeading", { count: documents.length })}${
    documentsUpdating ? ` · ${t("targetGroupsAdmin.documentsUpdating")}` : ""
  }`;

  return (
    <Box className="msqdx-glass-target-group-sources-panel" sx={{ width: "100%" }}>
      <PersonaV2SectionBlock title={documentsTitle}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <MsqdxMoleculeCard
            className={TG_V2_SURFACE_CLASS.create}
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={onUploadClick}
            title={t("targetGroupsAdmin.selectFile")}
            titleVariant="h6"
            subtitle={t("targetGroupsAdmin.uploadHint")}
            headerActions={<MsqdxIcon name="upload_file" customSize={22} style={{ color: accent }} />}
            sx={{
              ...tgV2CreateSurfaceSx(120),
              opacity: documentUploadPending ? 0.7 : 1,
              ...(documentUploadPending ? { pointerEvents: "none" as const } : {}),
            }}
          >
            <MsqdxButton
              variant="outlined"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onUploadClick();
              }}
              disabled={documentUploadPending}
              startIcon={
                <MsqdxIcon
                  name={documentUploadPending ? "hourglass_empty" : "upload"}
                  customSize={16}
                />
              }
            >
              {documentUploadPending
                ? t("targetGroupsAdmin.uploading")
                : t("targetGroupV2.sources.uploadAction")}
            </MsqdxButton>
          </MsqdxMoleculeCard>

          {documents.map((doc) => {
            const chip = documentIngestionChip(doc, chipLabels);
            return (
              <MsqdxMoleculeCard
                key={doc.id}
                className={TG_V2_SURFACE_CLASS.card}
                variant="flat"
                borderRadius="button"
                title={doc.filename}
                titleVariant="h6"
                subtitle={formatDocumentSize(doc.sizeBytes)}
                headerActions={
                  <MsqdxChip variant="filled" brandColor={chip.brandColor} label={chip.label} size="small" />
                }
                sx={{
                  ...tgV2CardSurfaceSx(120),
                  "& .MuiTypography-h6": { wordBreak: "break-word" },
                }}
              >
                {doc.ingestionStatus === "processing" && doc.ingestionProgress != null ? (
                  <Box sx={{ mt: 0.5, height: 4, bgcolor: "action.hover", borderRadius: 1, overflow: "hidden" }}>
                    <Box
                      sx={{
                        width: `${doc.ingestionProgress}%`,
                        height: "100%",
                        bgcolor: "primary.main",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </Box>
                ) : null}
              </MsqdxMoleculeCard>
            );
          })}
        </Box>

        {documents.length === 0 ? (
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mt: 1.5 }}>
            {t("targetGroupsAdmin.documentsEmpty")}
          </MsqdxTypography>
        ) : null}
      </PersonaV2SectionBlock>

      <PersonaV2SectionBlock
        title={t("targetGroupV2.sources.knowledgeHeading", { count: knowledgeEntries.length })}
      >
        <Stack spacing={1.5}>
          {knowledgeEntries.map((entry) => (
            <MsqdxMoleculeCard
              key={entry.id}
              className={TG_V2_SURFACE_CLASS.card}
              variant="flat"
              borderRadius="button"
              title={entry.title}
              titleVariant="h6"
              headerActions={
                <MsqdxButton
                  variant="text"
                  size="small"
                  brandColor="pink"
                  onClick={() => onDeleteKnowledge(entry.id)}
                  startIcon={<MsqdxIcon name="delete" customSize={18} />}
                  aria-label={t("targetGroupsAdmin.deleteKnowledge")}
                />
              }
              sx={tgV2CardSurfaceSx()}
            >
              <MsqdxTypography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {entry.content}
              </MsqdxTypography>
            </MsqdxMoleculeCard>
          ))}

          {!showAddKnowledge ? (
            <MsqdxMoleculeCard
              className={TG_V2_SURFACE_CLASS.create}
              variant="flat"
              borderRadius="button"
              clickable
              hoverable
              onClick={() => setShowAddKnowledge(true)}
              title={t("targetGroupsAdmin.newKnowledgeEntry")}
              titleVariant="h6"
              subtitle={t("targetGroupV2.sources.addKnowledgeHint")}
              headerActions={<MsqdxIcon name="add" customSize={22} style={{ color: accent }} />}
              sx={tgV2CreateSurfaceSx()}
            />
          ) : (
            <MsqdxMoleculeCard
              className={TG_V2_SURFACE_CLASS.card}
              variant="flat"
              borderRadius="button"
              title={t("targetGroupsAdmin.newKnowledgeEntry")}
              titleVariant="h6"
              sx={tgV2CardSurfaceSx()}
              actions={
                <>
                  <MsqdxButton
                    variant="outlined"
                    size="small"
                    type="button"
                    onClick={() => {
                      setShowAddKnowledge(false);
                      setKnowledgeForm(defaultKnowledgeForm);
                      setKnowledgeError(null);
                    }}
                    disabled={knowledgePending}
                  >
                    {t("common.cancel")}
                  </MsqdxButton>
                  <MsqdxButton
                    variant="contained"
                    size="small"
                    type="submit"
                    form="tg-sources-knowledge-form"
                    disabled={knowledgePending}
                    startIcon={
                      <MsqdxIcon name={knowledgePending ? "hourglass_empty" : "add"} customSize={16} />
                    }
                  >
                    {knowledgePending ? t("targetGroupsAdmin.adding") : t("targetGroupsAdmin.add")}
                  </MsqdxButton>
                </>
              }
            >
              <Box
                id="tg-sources-knowledge-form"
                component="form"
                onSubmit={(e) => void handleKnowledgeSubmit(e)}
                sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
              >
                <MsqdxFormField
                  label={t("targetGroupsAdmin.titleLabel")}
                  value={knowledgeForm.title}
                  onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={t("targetGroupsAdmin.titlePlaceholder")}
                  fullWidth
                  size="small"
                  sx={FORM_FIELD_ACCENT_SX}
                />
                <MsqdxTextareaField
                  label={t("targetGroupsAdmin.content")}
                  value={knowledgeForm.content}
                  onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder={t("targetGroupsAdmin.contentPlaceholder")}
                  minRows={4}
                  fullWidth
                  sx={FORM_FIELD_ACCENT_SX}
                />
                {knowledgeError ? (
                  <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                    {knowledgeError}
                  </MsqdxTypography>
                ) : null}
              </Box>
            </MsqdxMoleculeCard>
          )}

          {knowledgeEntries.length === 0 && !showAddKnowledge ? (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              {t("targetGroupsAdmin.knowledgeEmpty")}
            </MsqdxTypography>
          ) : null}
        </Stack>
      </PersonaV2SectionBlock>
    </Box>
  );
}
