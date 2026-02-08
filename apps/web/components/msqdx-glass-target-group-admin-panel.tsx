"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

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
import { MsqdxIcon, MsqdxFormField, MsqdxTextareaField, MsqdxButton, MsqdxTypography, MsqdxCard, MsqdxChip, MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassKnowledgeExplorer } from "./msqdx-glass-knowledge-explorer";
import { MsqdxGlassDashboardCardSection } from "./dashboard-cards/msqdx-glass-dashboard-card-section";
import { MsqdxGlassPersonaList } from "./msqdx-glass-persona-list";
import { MsqdxGlassEntityEditor } from "./generic";
import { BRAND_COLOR } from "../lib/branding";
import { MsqdxGlassCollapsiblePanel } from "./admin/msqdx-glass-collapsible-panel";
import { Box } from "@mui/material";

type MsqdxGlassTargetGroupAdminPanelProps = {
  initialList: TargetGroupListResponse;
  docsUrl: string;
};

type EditFormState = {
  name: string;
  segment: string;
  description: string;
  updatedBy: string;
};

type CreateFormState = {
  projectId: string;
  name: string;
  segment: string;
  description: string;
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
  projectId: "",
  name: "",
  segment: "",
  description: "",
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
}: MsqdxGlassTargetGroupAdminPanelProps) => {
  const [list, setList] = useState<TargetGroupListResponse>(initialList);
  const [selectedId, setSelectedId] = useState<string | null>(initialList.items[0]?.id ?? null);
  const [detail, setDetail] = useState<TargetGroupResponse | null>(null);
  const [createFormExpanded, setCreateFormExpanded] = useState(false);
  const [knowledgeFormExpanded, setKnowledgeFormExpanded] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<EditFormState>(defaultEditFormState);
  const [savePending, setSavePending] = useState(false);
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
    () => new Set(["basic", "metadata", "personas", "knowledge", "documents", "knowledge-explorer"])
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
        setDetailError(error instanceof Error ? error.message : "Failed to load target group");
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [selectedId, loadDetail]);

  const refreshList = useCallback(async () => {
    setListRefreshing(true);
    try {
      const updated = await fetchTargetGroupList();
      setList(updated);
      if (selectedId && !updated.items.find((item) => item.id === selectedId)) {
        setSelectedId(null);
        setDetail(null);
      }
      notify("List updated");
    } catch (error) {
      console.error("Failed to refresh list:", error);
      notify("Error updating list");
    } finally {
      setListRefreshing(false);
    }
  }, [selectedId]);

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
      notify("Target Group updated");
    } catch (error) {
      console.error("Save failed:", error);
      notify("Error saving");
      throw error;
    } finally {
      setSavePending(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.projectId || !createForm.name || !createForm.segment) {
      notify("Project ID, Name and Segment are required.");
      return;
    }
    setCreatePending(true);
    try {
      const payload = {
        project_id: createForm.projectId,
        name: createForm.name,
        segment: createForm.segment,
        description: createForm.description || null,
      };
      const created = await createTargetGroup(payload);
      setCreateForm(defaultCreateFormState);
      await refreshList();
      setSelectedId(created.id);
      notify("Target Group created");
    } catch (error) {
      console.error("Create failed:", error);
      notify("Error creating");
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
      notify("Title and content are required.");
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
      notify("Knowledge entry added");
    } catch (error) {
      console.error("Knowledge add failed:", error);
      notify("Failed to save knowledge entry");
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
      notify("Please select a Target Group");
      return;
    }
    setDocumentUploadPending(true);
    try {
      await uploadTargetGroupDocument(selectedId, file, "target-group-admin-ui");
      await loadDetail(selectedId);
      notify("Document uploaded");
    } catch (error) {
      console.error("Document upload failed", error);
      notify("Failed to upload document");
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
    if (!confirm("Are you sure you want to delete this knowledge entry?")) {
      return;
    }
    try {
      await deleteTargetGroupKnowledge(selectedId, knowledgeId);
      const knowledge = await fetchTargetGroupKnowledge(selectedId);
      setKnowledgeEntries(knowledge);
      notify("Knowledge entry deleted");
    } catch (error) {
      console.error("Knowledge delete failed:", error);
      notify("Error deleting");
    }
  };

  const handleCreatePersona = async (request: TargetGroupPersonaGenerateRequest) => {
    if (!selectedId) {
      notify("Please select a Target Group");
      return;
    }
    setCreatePersonaPending(true);
    try {
      await generateTargetGroupPersona(selectedId, request);
      await loadDetail(selectedId); // Reload to update persona list
      notify("Persona created");
      setPersonaFormExpanded(false);
      setPersonaForm(defaultPersonaForm);
    } catch (error) {
      console.error("Persona creation failed:", error);
      notify("Error creating persona");
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
      notify("Segment ist Pflicht.");
      return;
    }
    const request: TargetGroupPersonaGenerateRequest = {
      segment: personaForm.segment.trim(),
      description: personaForm.description.trim() || undefined,
      filterMode: "auto",
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
    <div className="msqdx-glass-admin-grid">
      <MsqdxGlassCollapsiblePanel title="Target Groups" defaultExpanded={true}>
        <section className="msqdx-glass-panel">
          <header className="msqdx-glass-panel__header">
            <div>
              <MsqdxTypography variant="h5" weight="semibold">Target Groups</MsqdxTypography>
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>{list.total} Einträge</MsqdxTypography>
            </div>
            <MsqdxButton variant="text" size="small" onClick={refreshList} disabled={listRefreshing} startIcon={<MsqdxIcon name="refresh" customSize={16} />}>
              Refresh
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
                No target groups available yet.
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
                  borderColor: selectedId === item.id ? "primary.main" : undefined,
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
              New Target Group
            </MsqdxTypography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <MsqdxFormField
                  label="Project ID"
                  value={createForm.projectId}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, projectId: e.target.value }))
                  }
                  placeholder="123e4567-e89b-12d3-a456-426614174000"
                  fullWidth
                  size="small"
                  borderColor={BRAND_COLOR}
                />
                <MsqdxButton
                  variant="text"
                  size="small"
                  onClick={() => {
                    let uuid: string;
                    if (typeof crypto !== "undefined" && crypto.randomUUID) {
                      uuid = crypto.randomUUID();
                    } else {
                      uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                        const r = (Math.random() * 16) | 0;
                        const v = c === "x" ? r : (r & 0x3) | 0x8;
                        return v.toString(16);
                      });
                    }
                    setCreateForm((prev) => ({ ...prev, projectId: uuid }));
                  }}
                  startIcon={<MsqdxIcon name="refresh" customSize={14} />}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Generate
                </MsqdxButton>
              </Box>
              <MsqdxFormField
                label="Name"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Target Group Name"
                fullWidth
                size="small"
                borderColor={BRAND_COLOR}
              />
              <MsqdxFormField
                label="Segment"
                value={createForm.segment}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, segment: e.target.value }))
                }
                placeholder="B2B / Enterprise / etc."
                fullWidth
                size="small"
                borderColor={BRAND_COLOR}
              />
              <MsqdxTextareaField
                label="Description"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Beschreibung"
                minRows={3}
                fullWidth
                borderColor={BRAND_COLOR}
              />
              <MsqdxButton
                variant="contained"
                brandColor="green"
                size="small"
                onClick={handleCreate}
                disabled={createPending}
                startIcon={<MsqdxIcon name="add" customSize={16} />}
              >
                Target Group anlegen
              </MsqdxButton>
            </Box>
          </MsqdxCard>
        </section>
      </MsqdxGlassCollapsiblePanel>

      <section className="msqdx-glass-panel">
        {!selectedId && <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>Please select a Target Group.</MsqdxTypography>}
        {selectedId && detailLoading && <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>Loading Target Group...</MsqdxTypography>}
        {detailError && <MsqdxTypography variant="body2" color="error">{detailError}</MsqdxTypography>}
        {detail && (
          <div className="msqdx-glass-detail">
            <div className="msqdx-glass-dashboard-grid">
              <Box sx={{ gridColumn: "1 / -1" }}>
                <MsqdxDashboardCard
                  id="basic"
                  title="Basic"
                  icon="groups"
                  brandColor={BRAND_COLOR}
                  iconColor={{ color: "var(--color-theme-accent)" }}
                  expanded={isAccordionExpanded("basic")}
                  onToggle={toggleAccordion}
                >
                  <MsqdxGlassEntityEditor
                    entityType="targetGroup"
                    entity={detail}
                    onSave={handleFieldSave}
                    inline={true}
                    disabled={savePending}
                  />
                </MsqdxDashboardCard>
              </Box>

              <Box sx={{ gridColumn: "1 / -1" }}>
                <MsqdxDashboardCard
                  id="metadata"
                  title="Metadaten"
                  icon="info"
                  brandColor={BRAND_COLOR}
                  iconColor={{ color: "var(--color-theme-accent)" }}
                  expanded={isAccordionExpanded("metadata")}
                  onToggle={toggleAccordion}
                >
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, borderLeft: "1px solid", borderColor: "divider", pl: 2 }}>
                    <Box>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>Project ID</MsqdxTypography>
                      <MsqdxTypography variant="body2">{detail.projectId ?? (detail as any).project_id ?? "—"}</MsqdxTypography>
                    </Box>
                    <Box>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>Created</MsqdxTypography>
                      <MsqdxTypography variant="body2">{formatDate(detail.createdAt ?? (detail as any).created_at ?? "")}</MsqdxTypography>
                    </Box>
                    <Box>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>Updated</MsqdxTypography>
                      <MsqdxTypography variant="body2">{formatDate(detail.updatedAt ?? (detail as any).updated_at ?? "")}</MsqdxTypography>
                    </Box>
                  </Box>
                </MsqdxDashboardCard>
              </Box>

            <Box sx={{ gridColumn: "1 / -1" }}>
                <MsqdxDashboardCard
                  id="personas"
                  title={`Personas (${personas.length})`}
                  icon="person"
                  brandColor={BRAND_COLOR}
                  iconColor={{ color: "var(--color-theme-accent)" }}
                  expanded={isAccordionExpanded("personas")}
                  onToggle={toggleAccordion}
                >
              <MsqdxGlassPersonaList 
                personas={personas} 
                onDelete={async (personaId: string) => {
                  const persona = personas.find(p => p.id === personaId);
                  const personaName = persona?.name || "this persona";
                  const confirmed = window.confirm(
                    `Are you sure you want to delete "${personaName}"?\n\nThis action cannot be undone. The persona will be permanently removed.`
                  );
                  
                  if (!confirmed) {
                    return;
                  }
                  
                  try {
                    const response = await fetch(`/api/persona-admin/${personaId}?actor=persona-admin-ui`, {
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
                    notify("Persona deleted");
                  } catch (error) {
                    console.error("Persona delete failed", error);
                    notify("Delete failed");
                  }
                }}
              />
              <Box sx={{ mt: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <MsqdxTypography variant="subtitle2" weight="semibold" sx={{ mb: 1.5 }}>Neue Persona erstellen</MsqdxTypography>
                <Box
                  component="form"
                  onSubmit={handlePersonaSubmit}
                  sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
                >
                  <MsqdxFormField
                    label="Segment Name"
                    value={personaForm.segment}
                    onChange={(e) => handlePersonaField("segment", e.target.value)}
                    placeholder="z.B. Skeptischer CFO, Technikaffiner CTO"
                    required
                    disabled={createPersonaPending}
                    fullWidth
                    size="small"
                    borderColor={BRAND_COLOR}
                  />
                  <MsqdxTextareaField
                    label="Beschreibung (optional)"
                    value={personaForm.description}
                    onChange={(e) => handlePersonaField("description", e.target.value)}
                    placeholder="Optionale Beschreibung was diese Persona repräsentiert"
                    minRows={3}
                    disabled={createPersonaPending}
                    fullWidth
                    borderColor={BRAND_COLOR}
                  />
                  <MsqdxButton
                    variant="outlined"
                    size="small"
                    type="submit"
                    disabled={createPersonaPending || !personaForm.segment.trim()}
                    startIcon={<MsqdxIcon name={createPersonaPending ? "hourglass_empty" : "add"} customSize={14} />}
                  >
                    {createPersonaPending ? "Erstelle..." : "Erstellen"}
                  </MsqdxButton>
                </Box>
              </Box>
                </MsqdxDashboardCard>
              </Box>

            <Box sx={{ gridColumn: "1 / -1" }}>
                <MsqdxDashboardCard
                  id="knowledge"
                  title={`Knowledge (${knowledgeEntries.length})`}
                  icon="menu_book"
                  brandColor={BRAND_COLOR}
                  iconColor={{ color: "var(--color-theme-accent)" }}
                  expanded={isAccordionExpanded("knowledge")}
                  onToggle={toggleAccordion}
                >
              {knowledgeEntries.length === 0 ? (
                <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>No knowledge entries yet.</MsqdxTypography>
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
                        aria-label="Knowledge Eintrag löschen"
                      />
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ mt: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <MsqdxTypography variant="subtitle2" weight="semibold" sx={{ mb: 1.5 }}>Neuer Knowledge Eintrag</MsqdxTypography>
                <Box
                  component="form"
                  onSubmit={handleKnowledgeSubmit}
                  sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
                >
                  <MsqdxFormField
                    label="Titel"
                    value={knowledgeForm.title}
                    onChange={(e) => handleKnowledgeField("title", e.target.value)}
                    placeholder="Titel"
                    fullWidth
                    size="small"
                    borderColor={BRAND_COLOR}
                  />
                  <MsqdxTextareaField
                    label="Inhalt"
                    value={knowledgeForm.content}
                    onChange={(e) => handleKnowledgeField("content", e.target.value)}
                    placeholder="Inhalt"
                    minRows={3}
                    fullWidth
                    borderColor={BRAND_COLOR}
                  />
                  <MsqdxButton
                    variant="outlined"
                    size="small"
                    type="submit"
                    disabled={knowledgePending}
                    startIcon={<MsqdxIcon name="add" customSize={14} />}
                  >
                    {knowledgePending ? "Adding..." : "Add"}
                  </MsqdxButton>
                </Box>
              </Box>
                </MsqdxDashboardCard>
              </Box>

            <Box sx={{ gridColumn: "1 / -1" }}>
                <MsqdxDashboardCard
                  id="documents"
                  title={`Dokumente (${documents.length})${documents.some((d) => d.ingestionStatus === "pending" || d.ingestionStatus === "processing") ? " · Updating…" : ""}`}
                  icon="description"
                  brandColor={BRAND_COLOR}
                  iconColor={{ color: "var(--color-theme-accent)" }}
                  expanded={isAccordionExpanded("documents")}
                  onToggle={toggleAccordion}
                >
              {documents.length === 0 && (
                <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>No documents uploaded.</MsqdxTypography>
              )}
              {documents.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {documents.map((doc) => {
                    const chipConfig =
                      doc.ingestionStatus === "completed"
                        ? { label: "INDEXED", brandColor: "green" as const }
                        : doc.ingestionStatus === "processing"
                          ? { label: `PROCESSING ${doc.ingestionProgress ? Math.round(doc.ingestionProgress) : 0}%`, brandColor: "orange" as const }
                          : doc.ingestionStatus === "failed"
                            ? { label: "ERROR", brandColor: "pink" as const }
                            : { label: "PENDING", brandColor: "orange" as const };
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

              <Box sx={{ mt: 2, p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 2, textAlign: "center" }}>
                <MsqdxIcon name="upload_file" customSize={32} style={{ color: "var(--color-theme-accent)", marginBottom: "0.5rem", display: "block" }} />
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                  PDF, DOCX, PPTX, MP3 — Drag file here or click to select
                </MsqdxTypography>
                <MsqdxButton
                  variant="outlined"
                  size="small"
                  onClick={triggerDocumentUpload}
                  disabled={documentUploadPending}
                  startIcon={<MsqdxIcon name="upload" customSize={14} />}
                >
                  {documentUploadPending ? "Uploading..." : "Select File"}
                </MsqdxButton>
              </Box>
                </MsqdxDashboardCard>
              </Box>

            <Box sx={{ gridColumn: "1 / -1" }}>
                <MsqdxDashboardCard
                  id="knowledge-explorer"
                  title="Knowledge Explorer"
                  icon="search"
                  brandColor={BRAND_COLOR}
                  iconColor={{ color: "var(--color-theme-accent)" }}
                  expanded={isAccordionExpanded("knowledge-explorer")}
                  onToggle={toggleAccordion}
                >
                  <MsqdxGlassKnowledgeExplorer targetGroupId={selectedId || ""} />
                </MsqdxDashboardCard>
              </Box>
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
          </div>
        )}
      </section>
    </div>
  );
};

