"use client";

import type { FormEvent } from "react";
import { Box } from "@mui/material";
import type { PersonaResponse } from "@msqdx-glass/types";

type KnowledgeFormState = {
  title: string;
  content: string;
};
import { MsqdxIcon, MsqdxDashboardCard, MsqdxButton, MsqdxFormField, MsqdxTextareaField } from "@msqdx/react";
import { MsqdxGlassDashboardCardSection } from "./msqdx-glass-dashboard-card-section";
import { useI18n } from "../i18n/i18n-provider";
import { THEME_ACCENT } from "../../lib/theme-accent";
import { buildApiUrl } from "../../app/api/_lib/backend";

export type MsqdxGlassKnowledgeSourcesCardProps = {
  detail: PersonaResponse;
  knowledgeForm: KnowledgeFormState;
  documentUploadPending: boolean;
  knowledgePending: boolean;
  selectedId: string | null;
  expanded: boolean;
  onToggle: (id: string) => void;
  onDocumentUpload: () => void;
  onKnowledgeField: (field: keyof KnowledgeFormState, value: string) => void;
  onKnowledgeSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onLoadDetail: (id: string) => Promise<void>;
  formatDate: (value?: string | null) => string;
  notify: (message: string) => void;
};

export const MsqdxGlassKnowledgeSourcesCard = ({
  detail,
  knowledgeForm,
  documentUploadPending,
  knowledgePending,
  selectedId,
  expanded,
  onToggle,
  onDocumentUpload,
  onKnowledgeField,
  onKnowledgeSubmit,
  onLoadDetail,
  formatDate,
  notify
}: MsqdxGlassKnowledgeSourcesCardProps) => {
  const { t } = useI18n();

  const handleDocumentRetry = async (docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedId) {
      alert(t("knowledgeSources.noPersonaSelected"));
      return;
    }
    alert(t("knowledgeSources.restartingIngestion"));
    try {
      const target = buildApiUrl(`/api/persona-admin/${selectedId}/documents/${docId}/retry`);
      const response = await fetch(target, { method: "POST" });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Backend responded with ${response.status}${errorText ? `: ${errorText}` : ""}`);
      }
      await response.json();
      alert(t("knowledgeSources.ingestionRestarted"));
      await onLoadDetail(selectedId);
      setTimeout(() => {
        onLoadDetail(selectedId);
      }, 2000);
    } catch (error) {
      console.error("❌ Retry failed", error);
      alert(`${t("knowledgeSources.error")}: ${error instanceof Error ? error.message : t("knowledgeSources.ingestionError")}`);
    }
  };

  const handleDocumentDelete = async (docId: string, filename: string) => {
    if (!selectedId) return;
    if (!confirm(t("knowledgeSources.deleteConfirm", { filename }))) {
      return;
    }
    try {
      const target = buildApiUrl(`/api/persona-admin/${selectedId}/documents/${docId}`);
      const response = await fetch(target, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      await onLoadDetail(selectedId);
      notify(t("knowledgeSources.documentDeleted"));
    } catch (error) {
      console.error("Delete failed", error);
      notify(t("knowledgeSources.documentDeleteFailed"));
    }
  };

  return (
    <Box sx={{ gridColumn: "1 / -1" }}>
    <MsqdxDashboardCard
      id="knowledge-sources"
      title={t("knowledgeSources.title")}
      icon="lightbulb"
      iconColor={{ color: THEME_ACCENT.color }}
      expanded={expanded}
      onToggle={onToggle}
    >
      <MsqdxGlassDashboardCardSection>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h4 style={{ margin: 0 }}>{t("knowledgeSources.documents")}</h4>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {detail.documents.some((doc) => doc.ingestionStatus === "pending" || doc.ingestionStatus === "processing") && (
              <span className="msqdx-glass-muted" style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}>
                <MsqdxIcon name="sync" customSize={14} style={{ animation: "spin 2s linear infinite" }} />
                {t("knowledgeSources.updatingStatus")}
              </span>
            )}
            <MsqdxButton
              variant="text"
              size="small"
              onClick={onDocumentUpload}
              disabled={documentUploadPending}
              startIcon={<MsqdxIcon name="upload" customSize={16} />}
            >
              {documentUploadPending ? t("knowledgeSources.uploading") : t("knowledgeSources.upload")}
            </MsqdxButton>
          </div>
        </div>
        {detail.documents.length === 0 && (
          <p className="msqdx-glass-muted" style={{ margin: 0 }}>{t("knowledgeSources.noDocuments")}</p>
        )}
        {detail.documents.length > 0 && (
          <ul className="msqdx-glass-card-list" style={{ marginTop: "0.5rem" }}>
            {detail.documents.map((doc) => {
              const progress = doc.ingestionProgress != null ? Math.round(doc.ingestionProgress) : 0;
              const ingestionChip = doc.ingestionStatus
                ? doc.ingestionStatus === "completed"
                  ? { label: t("knowledgeSources.indexed"), className: "msqdx-glass-chip --success" }
                  : doc.ingestionStatus === "processing"
                    ? { label: t("knowledgeSources.processing", { progress }), className: "msqdx-glass-chip --processing" }
                    : doc.ingestionStatus === "failed"
                      ? { label: t("knowledgeSources.error"), className: "msqdx-glass-chip --error" }
                      : { label: t("knowledgeSources.pending"), className: "msqdx-glass-chip --pending" }
                : null;
              return (
                <li key={doc.id}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <strong>{doc.filename}</strong>
                      {ingestionChip && <span className={ingestionChip.className}>{ingestionChip.label}</span>}
                    </div>
                    <p className="msqdx-glass-muted">
                      {doc.contentType} · {(doc.sizeBytes / 1024).toFixed(1)} KB · {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                  <div className="msqdx-glass-card-list__actions">
                    {doc.downloadUrl && (
                      <Box component="a" href={doc.downloadUrl} target="_blank" rel="noreferrer" sx={{ textDecoration: "none" }}>
                        <MsqdxButton
                          variant="text"
                          size="small"
                          startIcon={<MsqdxIcon name="download" customSize={16} />}
                        >
                          {t("knowledgeSources.download")}
                        </MsqdxButton>
                      </Box>
                    )}
                    {(doc.ingestionStatus === "failed" || doc.ingestionStatus === "pending" ||
                      (doc.ingestionStatus === "processing" && doc.ingestionProgress && doc.ingestionProgress < 10)) && (
                        <MsqdxButton
                          variant="text"
                          size="small"
                          onClick={(e) => handleDocumentRetry(doc.id, e)}
                          startIcon={<MsqdxIcon name="refresh" customSize={16} />}
                        >
                          {t("knowledgeSources.retry")}
                        </MsqdxButton>
                      )}
                    <MsqdxButton
                      variant="text"
                      size="small"
                      brandColor="pink"
                      onClick={() => handleDocumentDelete(doc.id, doc.filename)}
                      startIcon={<MsqdxIcon name="delete" customSize={16} />}
                    >
                      {t("knowledgeSources.delete")}
                    </MsqdxButton>
                  </div>
                  {doc.ingestionStatus === "processing" && doc.ingestionProgress !== null && (
                    <div style={{ marginTop: "8px" }}>
                      <div style={{ width: "100%", height: "4px", backgroundColor: "var(--color-neutral)", borderRadius: "2px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${doc.ingestionProgress}%`,
                            height: "100%",
                            backgroundColor: "var(--color-primary)",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {doc.insightSummary && <p className="msqdx-glass-code-block">{doc.insightSummary}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </MsqdxGlassDashboardCardSection>

      <MsqdxGlassDashboardCardSection title={t("knowledgeSources.knowledgeBase")}>
        <form onSubmit={onKnowledgeSubmit}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <MsqdxFormField
              label={t("knowledgeSources.titleLabel")}
              value={knowledgeForm.title}
              onChange={(e) => onKnowledgeField("title", e.target.value)}
              placeholder={t("knowledgeSources.titlePlaceholder")}
              fullWidth
            />
            <MsqdxTextareaField
              label={t("knowledgeSources.content")}
              value={knowledgeForm.content}
              onChange={(e) => onKnowledgeField("content", e.target.value)}
              placeholder={t("knowledgeSources.contentPlaceholder")}
              minRows={3}
              fullWidth
            />
            <MsqdxButton
              variant="contained"
              size="small"
              type="submit"
              disabled={knowledgePending}
              loading={knowledgePending}
              startIcon={<MsqdxIcon name="lightbulb" customSize={16} />}
              brandColor="purple"
            >
              {knowledgePending ? t("knowledgeSources.saving") : t("knowledgeSources.addKnowledge")}
            </MsqdxButton>
          </Box>
        </form>
        {detail.knowledge.length === 0 && (
          <p className="msqdx-glass-muted" style={{ marginTop: "1rem", marginBottom: 0 }}>
            {t("knowledgeSources.noKnowledgeEntries")}
          </p>
        )}
        {detail.knowledge.length > 0 && (
          <ul className="msqdx-glass-card-list" style={{ marginTop: "1rem" }}>
            {detail.knowledge.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.title}</strong>
                  <p className="msqdx-glass-muted">
                    {entry.createdBy} · {formatDate(entry.createdAt)}
                  </p>
                </div>
                <p className="msqdx-glass-code-block">{entry.content}</p>
              </li>
            ))}
          </ul>
        )}
      </MsqdxGlassDashboardCardSection>

      <MsqdxGlassDashboardCardSection title={t("knowledgeSources.sources")}>
        {detail.sources.length === 0 && (
          <p className="msqdx-glass-muted" style={{ margin: 0 }}>{t("knowledgeSources.noSourcesLinked")}</p>
        )}
        {detail.sources.length > 0 && (
          <ul className="msqdx-glass-sources" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            {detail.sources.map((source) => (
              <li key={source.chunk_id}>
                <span>{source.chunk_id}</span>
                <small>{t("knowledgeSources.confidence")} {source.confidence.toFixed(2)}</small>
              </li>
            ))}
          </ul>
        )}
      </MsqdxGlassDashboardCardSection>

      {detail.insights && (
        <MsqdxGlassDashboardCardSection title={t("knowledgeSources.insights")}>
          <dl className="msqdx-glass-meta-grid" style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
            <div>
              <dt>{t("knowledgeSources.chunks")}</dt>
              <dd>{detail.insights.relatedChunkIds.length}</dd>
            </div>
            <div>
              <dt>{t("knowledgeSources.graphRelations")}</dt>
              <dd>{detail.insights.graphRelationships.length}</dd>
            </div>
          </dl>
          {detail.insights.graphRelationships.length > 0 && (
            <ul className="msqdx-glass-sources" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
              {detail.insights.graphRelationships.map((relation, index) => (
                <li key={`${relation.relationship}-${index}`}>
                  <span>{relation.relationship}</span>
                  <small>{relation.nodes.join(", ")}</small>
                </li>
              ))}
            </ul>
          )}
        </MsqdxGlassDashboardCardSection>
      )}
    </MsqdxDashboardCard>
    </Box>
  );
};

