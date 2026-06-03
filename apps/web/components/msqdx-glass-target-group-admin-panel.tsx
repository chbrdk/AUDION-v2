"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  PersonaDocument,
  TargetGroupKnowledgeEntry,
  TargetGroupListItem,
  TargetGroupListResponse,
  TargetGroupResponse,
} from "@msqdx-glass/types";

import {
  createTargetGroup,
  createTargetGroupKnowledge,
  deleteTargetGroupKnowledge,
  fetchTargetGroup,
  fetchTargetGroupDocuments,
  fetchTargetGroupKnowledge,
  fetchTargetGroupList,
  fetchTargetGroupPersonas,
  generateTargetGroupPersona,
  type TargetGroupPersonaGenerateRequest,
  uploadTargetGroupDocument,
  updateTargetGroup,
} from "../app/api/_lib/target-group";
import type { PersonaListItem } from "@msqdx-glass/types";
import { MsqdxIcon, MsqdxFormField, MsqdxTextareaField, MsqdxButton, MsqdxTypography, MsqdxCard, MsqdxChip, MsqdxDashboardCard, MsqdxSelect } from "@msqdx/react";
import { MsqdxGlassKnowledgeExplorer } from "./msqdx-glass-knowledge-explorer";
import { MsqdxGlassDashboardCardSection } from "./dashboard-cards/msqdx-glass-dashboard-card-section";
import { MsqdxGlassPersonaList } from "./msqdx-glass-persona-list";
import { MsqdxGlassEntityEditor } from "./generic";
import { FORM_FIELD_ACCENT_SX, THEME_ACCENT } from "../lib/theme-accent";
import { MsqdxGlassCollapsiblePanel } from "./admin/msqdx-glass-collapsible-panel";
import { Box, Stack } from "@mui/material";
import { useProject } from "./projects/project-provider";
import { buildApiUrl } from "../app/api/_lib/backend";
import { useI18n } from "./i18n/i18n-provider";
import type { TargetGroupV2SectionId } from "../lib/target-group-v2-sections";
import {
  isTargetGroupV2SectionContentVisible,
  type TargetGroupAdminPresentation,
} from "../lib/target-group-v2-section-visibility";
import { TargetGroupAdminSectionSurface } from "./target-groups-v2/target-group-admin-section-surface";
import { MsqdxGlassTargetGroupBasicsHero } from "./target-groups-v2/msqdx-glass-target-group-basics-hero";
import { MsqdxGlassTargetGroupBasicsLocalization } from "./target-groups-v2/msqdx-glass-target-group-basics-localization";
import { MsqdxGlassPainGoalsSectorSeparator } from "./generic/msqdx-glass-pain-goals-sector-separator";
import { targetGroupV2PersonaDetailHref } from "../lib/target-group-basics-hero-layout";

type MsqdxGlassTargetGroupAdminPanelProps = {
  initialList: TargetGroupListResponse;
  docsUrl: string;
  mode?: "full" | "detail";
  activeTargetGroupId?: string | null;
  presentation?: TargetGroupAdminPresentation;
  visibleSection?: TargetGroupV2SectionId;
};

type EditFormState = {
  name: string;
  segment: string;
  description: string;
  updatedBy: string;
};

type CreateFormState = {
  name: string;
  segment: string;
  description: string;
  name_de: string;
  segment_de: string;
  description_de: string;
  status: "draft" | "published";
};

type KnowledgeFormState = {
  title: string;
  content: string;
};

type PersonaFormState = {
  segment: string;
  description: string;
};

const defaultEditFormState: EditFormState = {
  name: "",
  segment: "",
  description: "",
  updatedBy: "target-group-admin-ui",
};

const defaultCreateFormState: CreateFormState = {
  name: "",
  segment: "",
  description: "",
  name_de: "",
  segment_de: "",
  description_de: "",
  status: "draft",
};

const defaultKnowledgeForm: KnowledgeFormState = {
  title: "",
  content: "",
};

const defaultPersonaForm: PersonaFormState = {
  segment: "",
  description: "",
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const notify = (message: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const existingToasts = document.querySelectorAll(".msqdx-glass-toast");
  existingToasts.forEach((toast) => (toast as any).remove());

  const toast = document.createElement("div");
  toast.className = "msqdx-glass-toast";
  toast.textContent = message;

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "30px",
    right: "30px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "16px 24px",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
    zIndex: "99999",
    fontSize: "15px",
    fontWeight: "500",
    maxWidth: "450px",
    minWidth: "200px",
    animation: "slideIn 0.3s ease-out",
    pointerEvents: "auto",
    fontFamily: "system-ui, -apple-system, sans-serif",
    border: "2px solid rgba(255, 255, 255, 0.1)",
  });

  document.body.appendChild(toast);
  void toast.offsetHeight;

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease-out";
    setTimeout(() => {
      toast.parentNode?.removeChild(toast);
    }, 300);
  }, 5000);
};

export const MsqdxGlassTargetGroupAdminPanel = ({
  initialList,
  docsUrl,
  mode = "full",
  activeTargetGroupId = null,
  presentation,
  visibleSection,
}: MsqdxGlassTargetGroupAdminPanelProps) => {
  const { activeProjectId, activeProject } = useProject();
  const { t } = useI18n();
  const accent = "var(--color-theme-accent)";
  const isV2Section = presentation === "v2-section" && Boolean(visibleSection);
  const showSection = (blockSection: TargetGroupV2SectionId) =>
    isTargetGroupV2SectionContentVisible(visibleSection, presentation, blockSection);
  const [list, setList] = useState<TargetGroupListResponse>(initialList);
  const [selectedId, setSelectedId] = useState<string | null>(activeTargetGroupId ?? initialList.items[0]?.id ?? null);
  const [detail, setDetail] = useState<TargetGroupResponse | null>(null);
  const [createFormExpanded, setCreateFormExpanded] = useState(false);
  const [knowledgeFormExpanded, setKnowledgeFormExpanded] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<EditFormState>(defaultEditFormState);
  const [savePending, setSavePending] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    setEditingField(null);
  }, [selectedId]);
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateFormState);
  const [createPending, setCreatePending] = useState(false);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormState>(defaultKnowledgeForm);
  const [knowledgePending, setKnowledgePending] = useState(false);
  const [knowledgeEntries, setKnowledgeEntries] = useState<TargetGroupKnowledgeEntry[]>([]);
  const [documents, setDocuments] = useState<PersonaDocument[]>([]);
  const [documentUploadPending, setDocumentUploadPending] = useState(false);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [createPersonaDialogOpen, setCreatePersonaDialogOpen] = useState(false);
  const [createPersonaPending, setCreatePersonaPending] = useState(false);
  const [personaFormExpanded, setPersonaFormExpanded] = useState(false);
  const [personaForm, setPersonaForm] = useState<PersonaFormState>(defaultPersonaForm);
  const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(
    () => new Set(["basic", "personas", "documents"])
  );

  const isAccordionExpanded = (id: string) => expandedAccordions.has(id);
  const toggleAccordion = (id: string) => {
    setExpandedAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedListItem: TargetGroupListItem | undefined = useMemo(
    () => list.items.find((item) => item.id === selectedId),
    [list.items, selectedId]
  );

  const loadDetail = useCallback(
    async (targetGroupId: string) => {
      if (!targetGroupId || targetGroupId === "undefined") {
        return;
      }
      setDetailLoading(true);
      setDetailError(null);
      try {
        const response = await fetchTargetGroup(targetGroupId);
        // Normalize response to handle both snake_case and camelCase
        const responseAny = response as any;
        const normalizedResponse = {
          ...response,
          knowledgeEntries: response.knowledgeEntries ?? responseAny.knowledge_entries ?? [],
          projectId: response.projectId ?? responseAny.project_id ?? "",
          createdAt: response.createdAt ?? responseAny.created_at ?? "",
          updatedAt: response.updatedAt ?? responseAny.updated_at ?? "",
          name_de: response.name_de ?? responseAny.name_de ?? null,
          segment_de: response.segment_de ?? responseAny.segment_de ?? null,
          description_de: response.description_de ?? responseAny.description_de ?? null,
          status: response.status ?? responseAny.status ?? "draft",
        };
        setDetail(normalizedResponse);
        setEditForm({
          name: response.name,
          segment: response.segment,
          description: response.description ?? "",
          updatedBy: "target-group-admin-ui",
        });
        // Load knowledge entries
        const knowledge = await fetchTargetGroupKnowledge(targetGroupId);
        setKnowledgeEntries(knowledge);
        // Load documents
        const docs = await fetchTargetGroupDocuments(targetGroupId);
        setDocuments(docs);
        // Load personas
        try {
          const personasData = await fetchTargetGroupPersonas(targetGroupId);
          setPersonas(personasData.items);
        } catch (error) {
          console.error("Failed to load personas:", error);
          setPersonas([]);
        }
      } catch (error) {
        console.error("Failed to load target group:", error);
        setDetailError(error instanceof Error ? error.message : t("targetGroupsAdmin.loadFailed"));
      } finally {
        setDetailLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [selectedId, loadDetail]);

  // Detail page: keep selection in sync with the route.
  useEffect(() => {
    if (mode !== "detail") return;
    if (!activeTargetGroupId) return;
    if (selectedId !== activeTargetGroupId) {
      setSelectedId(activeTargetGroupId);
    }
  }, [mode, activeTargetGroupId, selectedId]);

  const refreshList = useCallback(async () => {
    if (!activeProjectId) {
      setList({ items: [], total: 0, page: 1, page_size: 20 });
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setListRefreshing(true);
    try {
      const updated = await fetchTargetGroupList(activeProjectId);
      setList(updated);
      if (selectedId && !updated.items.find((item) => item.id === selectedId)) {
        setSelectedId(null);
        setDetail(null);
      }
      notify(t("targetGroupsAdmin.toasts.listUpdated"));
    } catch (error) {
      console.error("Failed to refresh list:", error);
      notify(t("targetGroupsAdmin.toasts.listUpdateError"));
    } finally {
      setListRefreshing(false);
    }
  }, [selectedId, activeProjectId, t]);

  useEffect(() => {
    void refreshList();
  }, [refreshList, activeProjectId]);

  const handleEditField = (field: keyof EditFormState, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldSave = async (updates: Partial<TargetGroupResponse>) => {
    if (!selectedId || !detail) {
      return;
    }
    setSavePending(true);
    try {
      const payload: any = {
        updated_by: editForm.updatedBy,
        ...updates,
      };

      await updateTargetGroup(selectedId, payload);
      await loadDetail(selectedId);
      await refreshList();
      notify(t("targetGroupsAdmin.toasts.targetGroupUpdated"));
    } catch (error) {
      console.error("Save failed:", error);
      notify(t("targetGroupsAdmin.toasts.saveError"));
      throw error;
    } finally {
      setSavePending(false);
    }
  };

  const handleCreate = async () => {
    if (!activeProjectId || !createForm.name || !createForm.segment) {
      notify(t("targetGroupsAdmin.toasts.projectNameSegmentRequired"));
      return;
    }
    setCreatePending(true);
    try {
      const payload = {
        project_id: activeProjectId,
        name: createForm.name,
        segment: createForm.segment,
        description: createForm.description || null,
        name_de: createForm.name_de.trim() || null,
        segment_de: createForm.segment_de.trim() || null,
        description_de: createForm.description_de.trim() || null,
        status: createForm.status,
      };
      const created = await createTargetGroup(payload);
      setCreateForm(defaultCreateFormState);
      await refreshList();
      setSelectedId(created.id);
      notify(t("targetGroupsAdmin.toasts.targetGroupCreated"));
    } catch (error) {
      console.error("Create failed:", error);
      notify(t("targetGroupsAdmin.toasts.createError"));
    } finally {
      setCreatePending(false);
    }
  };

  const handleKnowledgeField = (field: keyof KnowledgeFormState, value: string) => {
    setKnowledgeForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleKnowledgeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || !knowledgeForm.title || !knowledgeForm.content) {
      notify(t("targetGroupsAdmin.toasts.titleContentRequired"));
      return;
    }
    setKnowledgePending(true);
    try {
      const payload = {
        title: knowledgeForm.title,
        content: knowledgeForm.content,
        created_by: "target-group-admin-ui",
      };
      await createTargetGroupKnowledge(selectedId, payload);
      const knowledge = await fetchTargetGroupKnowledge(selectedId);
      setKnowledgeEntries(knowledge);
      setKnowledgeForm(defaultKnowledgeForm);
      setKnowledgeFormExpanded(false);
      notify(t("targetGroupsAdmin.toasts.knowledgeAdded"));
    } catch (error) {
      console.error("Knowledge add failed:", error);
      notify(t("targetGroupsAdmin.toasts.knowledgeSaveFailed"));
    } finally {
      setKnowledgePending(false);
    }
  };

  // Auto-refresh document ingestion status
  useEffect(() => {
    if (!selectedId || !documents.length) return;
    const hasActiveIngestion = documents.some(
      (doc) => doc.ingestionStatus === "pending" || doc.ingestionStatus === "processing"
    );
    if (!hasActiveIngestion) return;
    const interval = setInterval(() => {
      if (selectedId) {
        void loadDetail(selectedId);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedId, documents, loadDetail]);

  const handleDocumentUpload = async (file: File) => {
    if (!selectedId) {
      notify(t("targetGroupsAdmin.toasts.selectTargetGroup"));
      return;
    }
    setDocumentUploadPending(true);
    try {
      await uploadTargetGroupDocument(selectedId, file, "target-group-admin-ui");
      await loadDetail(selectedId);
      notify(t("targetGroupsAdmin.toasts.documentUploaded"));
    } catch (error) {
      console.error("Document upload failed", error);
      notify(t("targetGroupsAdmin.toasts.documentUploadFailed"));
    } finally {
      setDocumentUploadPending(false);
    }
  };

  const triggerDocumentUpload = () => {
    documentInputRef.current?.click();
  };

  const handleDeleteKnowledge = async (knowledgeId: string) => {
    if (!selectedId) {
      return;
    }
    if (!confirm(t("targetGroupsAdmin.toasts.deleteKnowledgeConfirm"))) {
      return;
    }
    try {
      await deleteTargetGroupKnowledge(selectedId, knowledgeId);
      const knowledge = await fetchTargetGroupKnowledge(selectedId);
      setKnowledgeEntries(knowledge);
      notify(t("targetGroupsAdmin.toasts.knowledgeDeleted"));
    } catch (error) {
      console.error("Knowledge delete failed:", error);
      notify(t("targetGroupsAdmin.toasts.deleteError"));
    }
  };

  const handleCreatePersona = async (request: TargetGroupPersonaGenerateRequest) => {
    if (!selectedId) {
      notify(t("targetGroupsAdmin.toasts.selectTargetGroup"));
      return;
    }
    setCreatePersonaPending(true);
    try {
      await generateTargetGroupPersona(selectedId, request);
      await loadDetail(selectedId); // Reload to update persona list
      notify(t("targetGroupsAdmin.toasts.personaCreated"));
      setPersonaFormExpanded(false);
      setPersonaForm(defaultPersonaForm);
    } catch (error) {
      console.error("Persona creation failed:", error);
      notify(t("targetGroupsAdmin.toasts.personaCreateError"));
      throw error;
    } finally {
      setCreatePersonaPending(false);
    }
  };

  const handlePersonaField = (field: keyof PersonaFormState, value: string) => {
    setPersonaForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePersonaSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || !personaForm.segment.trim()) {
      notify(t("targetGroupsAdmin.toasts.segmentRequired"));
      return;
    }
    const request: TargetGroupPersonaGenerateRequest = {
      segment: personaForm.segment.trim(),
      description: personaForm.description.trim() || undefined,
      filterMode: "auto",
      // Omit output_locale: canonical English `profile` + server `profile_de` mirror (bilingual).
      variationParams: {
        randomize_chunks: true,
        temperature_mode: "random",
        randomize_prompt: true,
        chunk_sample_size: 40, // Optional: Limit für Sampling
        // Optional: seed: Date.now() für Debugging/Reproduzierbarkeit
      },
    };
    await handleCreatePersona(request);
  };

  return (
    <div
      className={isV2Section ? "msqdx-glass-target-group-v2-section-panel" : "msqdx-glass-admin-grid"}
      style={mode === "detail" && !isV2Section ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}
    >
      {mode === "full" && (
        <MsqdxGlassCollapsiblePanel title={t("targetGroupsAdmin.title")} defaultExpanded={true}>
          <section className="msqdx-glass-panel">
          <header className="msqdx-glass-panel__header">
            <div>
              <MsqdxTypography variant="h5" weight="semibold">{t("targetGroupsAdmin.title")}</MsqdxTypography>
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>{t("targetGroupsAdmin.entries", { count: list.total })}</MsqdxTypography>
            </div>
            <MsqdxButton variant="text" size="small" onClick={refreshList} disabled={listRefreshing} startIcon={<MsqdxIcon name="refresh" customSize={16} />}>
              {t("targetGroupsAdmin.refresh")}
            </MsqdxButton>
          </header>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              flexWrap: { xs: "nowrap", md: "nowrap" },
              gap: 1,
              overflowX: { xs: "visible", md: "auto" },
              overflowY: "visible",
              minWidth: 0,
              WebkitOverflowScrolling: "touch",
              pb: { md: 0.5 },
              "&::-webkit-scrollbar": { height: 6 },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "action.disabled",
                borderRadius: 3,
                "&:hover": { backgroundColor: "action.active" },
              },
            }}
          >
            {list.items.length === 0 && (
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                {t("targetGroupsAdmin.empty")}
              </MsqdxTypography>
            )}
            {list.items.map((item) => (
              <MsqdxCard
                key={item.id}
                variant="flat"
                clickable
                onClick={() => setSelectedId(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(item.id);
                  }
                }}
                sx={{
                  p: 1.5,
                  textAlign: "left",
                  width: { xs: "100%", md: "auto" },
                  minWidth: { xs: undefined, md: 220 },
                  flexShrink: { xs: 0, md: 0 },
                  borderColor: selectedId === item.id ? accent : undefined,
                  borderWidth: selectedId === item.id ? 2 : undefined,
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <MsqdxTypography variant="subtitle1" weight="semibold">
                      {item.name}
                    </MsqdxTypography>
                    <MsqdxChip variant="filled" brandColor="green" label={item.segment} size="small" />
                  </Box>
                </Box>
              </MsqdxCard>
            ))}
          </Box>
          <MsqdxCard variant="flat" borderRadius="button" sx={{ mt: 2, p: 2, border: "1px solid", borderColor: "divider" }}>
            <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
              {t("targetGroupsAdmin.newTargetGroup")}
            </MsqdxTypography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                {activeProject?.name
                  ? t("targetGroupsAdmin.projectLabel", { name: activeProject.name })
                  : activeProjectId
                    ? t("targetGroupsAdmin.projectIdLabel", { id: activeProjectId })
                    : t("targetGroupsAdmin.selectProject")}
              </MsqdxTypography>
              <MsqdxFormField
                label={t("targetGroupsAdmin.name")}
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t("targetGroupsAdmin.namePlaceholder")}
                fullWidth
                size="small"
                sx={FORM_FIELD_ACCENT_SX}
              />
              <MsqdxFormField
                label={t("targetGroupsAdmin.segment")}
                value={createForm.segment}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, segment: e.target.value }))
                }
                placeholder={t("targetGroupsAdmin.segmentPlaceholder")}
                fullWidth
                size="small"
                sx={FORM_FIELD_ACCENT_SX}
              />
              <MsqdxTextareaField
                label={t("targetGroupsAdmin.description")}
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder={t("targetGroupsAdmin.descriptionPlaceholder")}
                minRows={3}
                fullWidth
                sx={FORM_FIELD_ACCENT_SX}
              />
              <MsqdxFormField
                label="Name (DE)"
                value={createForm.name_de}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name_de: e.target.value }))}
                placeholder="German display name (optional)"
                fullWidth
                size="small"
                sx={FORM_FIELD_ACCENT_SX}
              />
              <MsqdxFormField
                label="Segment (DE)"
                value={createForm.segment_de}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, segment_de: e.target.value }))}
                placeholder="German segment (optional)"
                fullWidth
                size="small"
                sx={FORM_FIELD_ACCENT_SX}
              />
              <MsqdxTextareaField
                label="Description (DE)"
                value={createForm.description_de}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description_de: e.target.value }))}
                placeholder="German description (optional)"
                minRows={2}
                fullWidth
                sx={FORM_FIELD_ACCENT_SX}
              />
              <MsqdxSelect
                label={t("targetGroupsAdmin.publicationStatus")}
                value={createForm.status}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    status: e.target.value === "published" ? "published" : "draft",
                  }))
                }
                options={[
                  { value: "draft", label: t("targetGroupsAdmin.statusDraft") },
                  { value: "published", label: t("targetGroupsAdmin.statusPublished") },
                ]}
                size="small"
                sx={{ ...FORM_FIELD_ACCENT_SX, maxWidth: 360 }}
              />
              <MsqdxButton
                variant="contained"
                size="small"
                onClick={handleCreate}
                disabled={createPending || !activeProjectId}
                startIcon={<MsqdxIcon name="add" customSize={16} />}
                sx={{
                  backgroundColor: `${accent} !important`,
                  color: "white !important",
                  "&:hover": { backgroundColor: `${accent} !important`, filter: "brightness(1.05)" },
                }}
              >
                {t("targetGroupsAdmin.create")}
              </MsqdxButton>
            </Box>
          </MsqdxCard>
          </section>
        </MsqdxGlassCollapsiblePanel>
      )}

      <section
        className={isV2Section ? undefined : "msqdx-glass-panel"}
        style={mode === "detail" && !isV2Section ? { gridColumn: "1 / -1" } : undefined}
      >
        {!selectedId && !isV2Section && (
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
            {t("targetGroupsAdmin.selectTargetGroup")}
          </MsqdxTypography>
        )}
        {selectedId && detailLoading && <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>{t("targetGroupsAdmin.loading")}</MsqdxTypography>}
        {detailError && <MsqdxTypography variant="body2" color="error">{detailError}</MsqdxTypography>}
        {detail && (
          <div
            className={
              isV2Section
                ? "msqdx-glass-dashboard-grid msqdx-glass-dashboard-grid--v2-section"
                : "msqdx-glass-dashboard-grid"
            }
          >
              {showSection("basics") ? (
              <Box
                sx={{ gridColumn: "1 / -1", width: "100%" }}
                className={isV2Section ? "msqdx-glass-target-group-basics-section" : undefined}
              >
                {isV2Section ? (
                  <Stack
                    component="section"
                    className="msqdx-glass-target-group-basics-stack"
                    spacing={0}
                  >
                    <TargetGroupAdminSectionSurface
                      embedInSection
                      hideBlockTitle
                      cardId="target-group-basics-hero"
                      title={t("targetGroupsAdmin.basic")}
                      icon="groups"
                      expanded={isAccordionExpanded("basic")}
                      onToggle={toggleAccordion}
                    >
                      <MsqdxGlassTargetGroupBasicsHero
                        detail={detail}
                        selectedId={selectedId}
                        editingField={editingField}
                        setEditingField={setEditingField}
                        savePending={savePending}
                        onSave={handleFieldSave}
                        formatDate={formatDate}
                      />
                    </TargetGroupAdminSectionSurface>

                    <MsqdxGlassPainGoalsSectorSeparator />

                    <MsqdxGlassTargetGroupBasicsLocalization
                      detail={detail}
                      selectedId={selectedId}
                      savePending={savePending}
                      onSave={handleFieldSave}
                    />
                  </Stack>
                ) : (
                  <>
                    <TargetGroupAdminSectionSurface
                      embedInSection={false}
                      cardId="basic"
                      title={t("targetGroupsAdmin.basic")}
                      icon="groups"
                      expanded={isAccordionExpanded("basic")}
                      onToggle={toggleAccordion}
                    >
                      <MsqdxGlassEntityEditor
                        entityType="targetGroup"
                        entity={detail}
                        entitySyncKey={selectedId ?? ""}
                        onSave={handleFieldSave}
                        inline
                        disabled={savePending}
                      />
                    </TargetGroupAdminSectionSurface>

                    <TargetGroupAdminSectionSurface
                      embedInSection={false}
                      cardId="metadata"
                      title={t("targetGroupsAdmin.metadata")}
                      icon="info"
                      expanded={isAccordionExpanded("metadata")}
                      onToggle={toggleAccordion}
                    >
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, borderLeft: "1px solid", borderColor: "divider", pl: 2 }}>
                        <Box>
                          <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>{t("targetGroupsAdmin.projectId")}</MsqdxTypography>
                          <MsqdxTypography variant="body2">{detail.projectId ?? (detail as any).project_id ?? "—"}</MsqdxTypography>
                        </Box>
                        <Box>
                          <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>{t("targetGroupsAdmin.created")}</MsqdxTypography>
                          <MsqdxTypography variant="body2">{formatDate(detail.createdAt ?? (detail as any).created_at ?? "")}</MsqdxTypography>
                        </Box>
                        <Box>
                          <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>{t("targetGroupsAdmin.updated")}</MsqdxTypography>
                          <MsqdxTypography variant="body2">{formatDate(detail.updatedAt ?? (detail as any).updated_at ?? "")}</MsqdxTypography>
                        </Box>
                      </Box>
                    </TargetGroupAdminSectionSurface>
                  </>
                )}
              </Box>
              ) : null}

              {showSection("personas") ? (
              <TargetGroupAdminSectionSurface
                embedInSection={isV2Section}
                cardId="personas"
                title={t("targetGroupsAdmin.personas", { count: personas.length })}
                icon="person"
                expanded={isAccordionExpanded("personas")}
                onToggle={toggleAccordion}
              >
                  <MsqdxGlassPersonaList
                    personas={personas}
                    getPersonaDetailHref={isV2Section ? targetGroupV2PersonaDetailHref : undefined}
                    showConfidence={!isV2Section}
                    onDelete={async (personaId: string) => {
                      const persona = personas.find(p => p.id === personaId);
                      const personaName = persona?.name || t("targetGroupsAdmin.thisPersona");
                      const confirmed = window.confirm(
                        t("targetGroupsAdmin.deletePersonaConfirm", { name: personaName })
                      );

                      if (!confirmed) {
                        return;
                      }

                      try {
                        const response = await fetch(buildApiUrl(`/api/persona-admin/${personaId}?actor=persona-admin-ui`), {
                          method: "DELETE",
                        });
                        if (!response.ok) {
                          throw new Error(`Backend responded with ${response.status}`);
                        }
                        // Refresh personas list
                        if (selectedId) {
                          const personasData = await fetchTargetGroupPersonas(selectedId);
                          setPersonas(personasData.items);
                        }
                        notify(t("targetGroupsAdmin.toasts.personaDeleted"));
                      } catch (error) {
                        console.error("Persona delete failed", error);
                        notify(t("targetGroupsAdmin.toasts.deleteFailed"));
                      }
                    }}
                  />
                  {isV2Section ? <MsqdxGlassPainGoalsSectorSeparator /> : null}
                  <Box sx={{ mt: isV2Section ? 0 : 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                    <MsqdxTypography variant="subtitle2" weight="semibold" sx={{ mb: 1.5 }}>{t("targetGroupsAdmin.createPersona")}</MsqdxTypography>
                    <Box
                      component="form"
                      onSubmit={handlePersonaSubmit}
                      sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
                    >
                      <MsqdxFormField
                        label={t("targetGroupsAdmin.segmentName")}
                        value={personaForm.segment}
                        onChange={(e) => handlePersonaField("segment", e.target.value)}
                        placeholder={t("targetGroupsAdmin.segmentPlaceholderPersona")}
                        required
                        disabled={createPersonaPending}
                        fullWidth
                        size="small"
                        sx={FORM_FIELD_ACCENT_SX}
                      />
                      <MsqdxTextareaField
                        label={t("targetGroupsAdmin.descriptionOptional")}
                        value={personaForm.description}
                        onChange={(e) => handlePersonaField("description", e.target.value)}
                        placeholder={t("targetGroupsAdmin.descriptionOptionalPlaceholder")}
                        minRows={3}
                        disabled={createPersonaPending}
                        fullWidth
                        sx={FORM_FIELD_ACCENT_SX}
                      />
                      <MsqdxButton
                        variant="outlined"
                        size="small"
                        type="submit"
                        disabled={createPersonaPending || !personaForm.segment.trim()}
                        startIcon={<MsqdxIcon name={createPersonaPending ? "hourglass_empty" : "add"} customSize={14} />}
                      >
                        {createPersonaPending ? t("targetGroupsAdmin.creating") : t("targetGroupsAdmin.createButton")}
                      </MsqdxButton>
                    </Box>
                  </Box>
              </TargetGroupAdminSectionSurface>
              ) : null}

              {showSection("knowledge") ? (
              <TargetGroupAdminSectionSurface
                embedInSection={isV2Section}
                cardId="knowledge"
                title={t("targetGroupsAdmin.knowledge", { count: knowledgeEntries.length })}
                icon="menu_book"
                expanded={isAccordionExpanded("knowledge")}
                onToggle={toggleAccordion}
              >
                  {knowledgeEntries.length === 0 ? (
                    <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>{t("targetGroupsAdmin.knowledgeEmpty")}</MsqdxTypography>
                  ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      {knowledgeEntries.map((entry) => (
                        <Box
                          key={entry.id}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            p: 1,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                          }}
                        >
                          <MsqdxTypography variant="body2" weight="semibold">{entry.title}</MsqdxTypography>
                          <MsqdxButton
                            variant="text"
                            size="small"
                            brandColor="pink"
                            onClick={() => handleDeleteKnowledge(entry.id)}
                            startIcon={<MsqdxIcon name="delete" customSize={18} />}
                            aria-label={t("targetGroupsAdmin.deleteKnowledge")}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}

                  {isV2Section ? <MsqdxGlassPainGoalsSectorSeparator /> : null}

                  <Box sx={{ mt: isV2Section ? 0 : 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                    <MsqdxTypography variant="subtitle2" weight="semibold" sx={{ mb: 1.5 }}>{t("targetGroupsAdmin.newKnowledgeEntry")}</MsqdxTypography>
                    <Box
                      component="form"
                      onSubmit={handleKnowledgeSubmit}
                      sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
                    >
                      <MsqdxFormField
                        label={t("targetGroupsAdmin.titleLabel")}
                        value={knowledgeForm.title}
                        onChange={(e) => handleKnowledgeField("title", e.target.value)}
                        placeholder={t("targetGroupsAdmin.titlePlaceholder")}
                        fullWidth
                        size="small"
                        sx={FORM_FIELD_ACCENT_SX}
                      />
                      <MsqdxTextareaField
                        label={t("targetGroupsAdmin.content")}
                        value={knowledgeForm.content}
                        onChange={(e) => handleKnowledgeField("content", e.target.value)}
                        placeholder={t("targetGroupsAdmin.contentPlaceholder")}
                        minRows={3}
                        fullWidth
                        sx={FORM_FIELD_ACCENT_SX}
                      />
                      <MsqdxButton
                        variant="outlined"
                        size="small"
                        type="submit"
                        disabled={knowledgePending}
                        startIcon={<MsqdxIcon name="add" customSize={14} />}
                      >
                        {knowledgePending ? t("targetGroupsAdmin.adding") : t("targetGroupsAdmin.add")}
                      </MsqdxButton>
                    </Box>
                  </Box>
              </TargetGroupAdminSectionSurface>
              ) : null}

              {showSection("documents") ? (
              <TargetGroupAdminSectionSurface
                embedInSection={isV2Section}
                cardId="documents"
                title={t("targetGroupsAdmin.documents", { count: documents.length }) + (documents.some((d) => d.ingestionStatus === "pending" || d.ingestionStatus === "processing") ? t("targetGroupsAdmin.documentsUpdating") : "")}
                icon="description"
                expanded={isAccordionExpanded("documents")}
                onToggle={toggleAccordion}
              >
                  {documents.length === 0 && (
                    <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>{t("targetGroupsAdmin.documentsEmpty")}</MsqdxTypography>
                  )}
                  {documents.length > 0 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {documents.map((doc) => {
                        const chipConfig =
                          doc.ingestionStatus === "completed"
                            ? { label: t("targetGroupsAdmin.indexed"), brandColor: "green" as const }
                            : doc.ingestionStatus === "processing"
                              ? { label: t("targetGroupsAdmin.processing", { progress: doc.ingestionProgress ? Math.round(doc.ingestionProgress) : 0 }), brandColor: "orange" as const }
                              : doc.ingestionStatus === "failed"
                                ? { label: t("targetGroupsAdmin.error"), brandColor: "pink" as const }
                                : { label: t("targetGroupsAdmin.pending"), brandColor: "orange" as const };
                        return (
                          <Box
                            key={doc.id}
                            sx={{
                              p: 1.5,
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 1,
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                              <MsqdxTypography variant="body2" weight="semibold">{doc.filename}</MsqdxTypography>
                              <MsqdxChip variant="filled" brandColor={chipConfig.brandColor} label={chipConfig.label} size="small" />
                            </Box>
                            {doc.ingestionStatus === "processing" && doc.ingestionProgress != null && (
                              <Box sx={{ mt: 1, height: 4, bgcolor: "action.hover", borderRadius: 1, overflow: "hidden" }}>
                                <Box
                                  sx={{
                                    width: `${doc.ingestionProgress}%`,
                                    height: "100%",
                                    bgcolor: "primary.main",
                                    transition: "width 0.3s ease",
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  {isV2Section ? <MsqdxGlassPainGoalsSectorSeparator /> : null}

                  <Box sx={{ mt: isV2Section ? 0 : 2, p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 2, textAlign: "center" }}>
                    <MsqdxIcon name="upload_file" customSize={32} style={{ color: THEME_ACCENT.color, marginBottom: "0.5rem", display: "block" }} />
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                      {t("targetGroupsAdmin.uploadHint")}
                    </MsqdxTypography>
                    <MsqdxButton
                      variant="outlined"
                      size="small"
                      onClick={triggerDocumentUpload}
                      disabled={documentUploadPending}
                      startIcon={<MsqdxIcon name="upload" customSize={14} />}
                    >
                      {documentUploadPending ? t("targetGroupsAdmin.uploading") : t("targetGroupsAdmin.selectFile")}
                    </MsqdxButton>
                  </Box>
              </TargetGroupAdminSectionSurface>
              ) : null}

              {showSection("explorer") ? (
              <TargetGroupAdminSectionSurface
                embedInSection={isV2Section}
                cardId="knowledge-explorer"
                title={t("targetGroupsAdmin.knowledgeExplorer")}
                icon="search"
                expanded={isAccordionExpanded("knowledge-explorer")}
                onToggle={toggleAccordion}
              >
                  <MsqdxGlassKnowledgeExplorer targetGroupId={selectedId || ""} />
              </TargetGroupAdminSectionSurface>
              ) : null}
              <input
                ref={documentInputRef}
                type="file"
                hidden
                accept=".pdf,.doc,.docx,.ppt,.pptx,.mp3,.wav,.m4a"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    await handleDocumentUpload(file);
                    event.target.value = "";
                  }
                }}
              />
            </div>
        )}
      </section>
    </div>
  );
};
