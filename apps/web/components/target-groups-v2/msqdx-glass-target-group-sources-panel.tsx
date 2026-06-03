"use client";

import { useState, type FormEvent } from "react";
import { Box, Divider, Stack } from "@mui/material";
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
import { useI18n } from "../i18n/i18n-provider";

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

  const sectionHeadingSx = {
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "text.secondary",
    mb: 1.5,
  } as const;

  return (
    <Box className="msqdx-glass-target-group-sources-panel" sx={{ width: "100%" }}>
      <Box sx={{ mb: 3 }}>
        <MsqdxTypography variant="caption" sx={sectionHeadingSx}>
          {t("targetGroupV2.sources.documentsHeading", { count: documents.length })}
          {documentsUpdating ? ` · ${t("targetGroupsAdmin.documentsUpdating")}` : ""}
        </MsqdxTypography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <MsqdxMoleculeCard
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
              minHeight: 120,
              border: "2px dashed",
              borderColor: accent,
              opacity: documentUploadPending ? 0.7 : 1,
              pointerEvents: documentUploadPending ? "none" : undefined,
              "& .MuiTypography-h6": { color: accent },
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
                variant="flat"
                borderRadius="button"
                title={doc.filename}
                titleVariant="h6"
                subtitle={formatDocumentSize(doc.sizeBytes)}
                headerActions={
                  <MsqdxChip variant="filled" brandColor={chip.brandColor} label={chip.label} size="small" />
                }
                sx={{
                  minHeight: 120,
                  border: "1px solid",
                  borderColor: accent,
                  "& .MuiTypography-h6": { color: accent, wordBreak: "break-word" },
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
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box>
        <MsqdxTypography variant="caption" sx={sectionHeadingSx}>
          {t("targetGroupV2.sources.knowledgeHeading", { count: knowledgeEntries.length })}
        </MsqdxTypography>

        <Stack spacing={1.5}>
          {knowledgeEntries.map((entry) => (
            <MsqdxMoleculeCard
              key={entry.id}
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
              sx={{
                border: "1px solid",
                borderColor: accent,
                "& .MuiTypography-h6": { color: accent },
              }}
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
              variant="flat"
              borderRadius="button"
              clickable
              hoverable
              onClick={() => setShowAddKnowledge(true)}
              title={t("targetGroupsAdmin.newKnowledgeEntry")}
              titleVariant="h6"
              subtitle={t("targetGroupV2.sources.addKnowledgeHint")}
              headerActions={<MsqdxIcon name="add" customSize={22} style={{ color: accent }} />}
              sx={{
                border: "2px dashed",
                borderColor: accent,
                "& .MuiTypography-h6": { color: accent },
              }}
            />
          ) : (
            <MsqdxMoleculeCard
              variant="flat"
              borderRadius="button"
              title={t("targetGroupsAdmin.newKnowledgeEntry")}
              titleVariant="h6"
              sx={{
                border: "1px solid",
                borderColor: accent,
                "& .MuiTypography-h6": { color: accent },
              }}
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
      </Box>
    </Box>
  );
}
