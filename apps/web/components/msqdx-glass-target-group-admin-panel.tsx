"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import clsx from "clsx";

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
import { MaterialSymbol } from "./material-symbol";
import { MsqdxGlassKnowledgeExplorer } from "./msqdx-glass-knowledge-explorer";
import { MsqdxGlassPersonaList } from "./msqdx-glass-persona-list";
import { MsqdxGlassEntityEditor } from "./generic";
import { MsqdxGlassCollapsiblePanel } from "./admin/msqdx-glass-collapsible-panel";

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
  const [documentUploadExpanded, setDocumentUploadExpanded] = useState(false);
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
      setDocumentUploadExpanded(false);
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
              <h2>Target Groups</h2>
              <p>{list.total} Einträge</p>
            </div>
            <button
              className="msqdx-glass-button --ghost"
              onClick={refreshList}
              disabled={listRefreshing}
            >
              <MaterialSymbol icon="refresh" fontSize={16} /> Refresh
            </button>
          </header>
          <div className="msqdx-glass-list">
            {list.items.length === 0 && (
              <p className="msqdx-glass-empty">No target groups available yet.</p>
            )}
            {list.items.map((item) => {
              return (
                <button
                  key={item.id}
                  className={clsx("msqdx-glass-list-item", selectedId === item.id && "is-active")}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="msqdx-glass-list-item__row">
                    <strong>{item.name}</strong>
                    <span className="msqdx-glass-chip --published">{item.segment}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="msqdx-glass-create-form">
            <button
              type="button"
              className="msqdx-glass-create-form__header"
              onClick={() => setCreateFormExpanded(!createFormExpanded)}
            >
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: 0 }}>New Target Group</h3>
              <MaterialSymbol 
                icon={createFormExpanded ? "expand_less" : "expand_more"} 
                fontSize={20} 
              />
            </button>
            {createFormExpanded && (
              <div className="msqdx-glass-create-form__content">
                <div className="msqdx-glass-field">
              <label>Project ID</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  value={createForm.projectId}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, projectId: event.target.value }))
                  }
                  placeholder="123e4567-e89b-12d3-a456-426614174000"
                  style={{ width: "100%" }}
                />
                <button
                  type="button"
                  className="msqdx-glass-button --ghost"
                  onClick={() => {
                    // Generate a new UUID v4
                    let uuid: string;
                    if (typeof crypto !== "undefined" && crypto.randomUUID) {
                      uuid = crypto.randomUUID();
                    } else {
                      // Fallback for older browsers
                      uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                        const r = (Math.random() * 16) | 0;
                        const v = c === "x" ? r : (r & 0x3) | 0x8;
                        return v.toString(16);
                      });
                    }
                    setCreateForm((prev) => ({ ...prev, projectId: uuid }));
                  }}
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", alignSelf: "flex-start", whiteSpace: "nowrap" }}
                  title="Generate new UUID"
                >
                  <MaterialSymbol icon="refresh" fontSize={14} /> Generate
                </button>
              </div>
            </div>
            <div className="msqdx-glass-field">
              <label>Name</label>
              <input
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Target Group Name"
              />
            </div>
            <div className="msqdx-glass-field">
              <label>Segment</label>
              <input
                value={createForm.segment}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, segment: event.target.value }))
                }
                placeholder="B2B / Enterprise / etc."
              />
            </div>
            <div className="msqdx-glass-field">
              <label>Description</label>
              <textarea
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Beschreibung"
                rows={3}
              />
            </div>
            <button
              className="msqdx-glass-button"
              onClick={handleCreate}
              disabled={createPending}
              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
            >
              <MaterialSymbol icon="add" fontSize={14} /> Target Group anlegen
            </button>
              </div>
            )}
          </div>
        </section>
      </MsqdxGlassCollapsiblePanel>

      <section className="msqdx-glass-panel">
        {!selectedId && <p className="msqdx-glass-empty">Please select a Target Group.</p>}
        {selectedId && detailLoading && <p className="msqdx-glass-muted">Loading Target Group...</p>}
        {detailError && <p className="msqdx-glass-error">{detailError}</p>}
        {detail && (
          <div className="msqdx-glass-detail">
            <header className="msqdx-glass-detail__header">
              <div className="msqdx-glass-detail__title">
                <MsqdxGlassEntityEditor
                  entityType="targetGroup"
                  entity={detail}
                  onSave={handleFieldSave}
                  inline={true}
                  disabled={savePending}
                />
              </div>
            </header>

            <div className="msqdx-glass-detail__grid">
              <div style={{ border: "1px solid var(--color-theme-accent)", borderRadius: "12px", padding: "0.75rem", marginTop: "1rem" }}>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 100, marginBottom: "2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Metadaten</h3>
                <dl className="msqdx-glass-meta-grid">
                  <div>
                    <dt>Project ID</dt>
                    <dd>{detail.projectId ?? (detail as any).project_id ?? ""}</dd>
                  </div>
                  <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
                    <dt>Created</dt>
                    <dd>{formatDate(detail.createdAt ?? (detail as any).created_at ?? "")}</dd>
                  </div>
                  <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
                    <dt>Updated</dt>
                    <dd>{formatDate(detail.updatedAt ?? (detail as any).updated_at ?? "")}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="msqdx-glass-detail__section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 100, marginBottom: "2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Personas ({personas.length})</h3>
              </div>
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
              
              <div className="msqdx-glass-create-form" style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="msqdx-glass-create-form__header"
                  onClick={() => setPersonaFormExpanded(!personaFormExpanded)}
                >
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: 0 }}>Neue Persona erstellen</h3>
                  <MaterialSymbol 
                    icon={personaFormExpanded ? "expand_less" : "expand_more"} 
                    fontSize={20} 
                  />
                </button>
                {personaFormExpanded && (
                  <form onSubmit={handlePersonaSubmit} className="msqdx-glass-create-form__content">
                    <div className="msqdx-glass-field">
                      <label>Segment Name <span style={{ color: "var(--color-secondary-dx-pink)" }}>*</span></label>
                      <input
                        value={personaForm.segment}
                        onChange={(event) => handlePersonaField("segment", event.target.value)}
                        placeholder="z.B. Skeptischer CFO, Technikaffiner CTO"
                        required
                        disabled={createPersonaPending}
                      />
                    </div>
                    <div className="msqdx-glass-field">
                      <label>Beschreibung (optional)</label>
                      <textarea
                        value={personaForm.description}
                        onChange={(event) => handlePersonaField("description", event.target.value)}
                        placeholder="Optionale Beschreibung was diese Persona repräsentiert"
                        rows={3}
                        disabled={createPersonaPending}
                      />
                    </div>
                    <button
                      className="msqdx-glass-button --ghost"
                      type="submit"
                      disabled={createPersonaPending || !personaForm.segment.trim()}
                      style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                    >
                      <MaterialSymbol icon={createPersonaPending ? "hourglass_empty" : "add"} fontSize={14} />{" "}
                      {createPersonaPending ? "Erstelle..." : "Erstellen"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="msqdx-glass-detail__section">
              <h3 style={{ fontSize: "1.5rem", fontWeight: 100, marginBottom: "2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Knowledge ({knowledgeEntries.length})</h3>
              {knowledgeEntries.length === 0 ? (
                <p className="msqdx-glass-empty">No knowledge entries yet.</p>
              ) : (
                <div className="msqdx-glass-list">
                  {knowledgeEntries.map((entry) => (
                    <div key={entry.id} className="msqdx-glass-list-item">
                      <div className="msqdx-glass-list-item__row">
                        <strong>{entry.title}</strong>
                        <button
                          className="msqdx-glass-button --ghost"
                          onClick={() => handleDeleteKnowledge(entry.id)}
                          style={{ padding: "0.375rem", fontSize: "0.75rem", color: "var(--color-secondary-dx-pink)" }}
                          title="Knowledge Eintrag löschen"
                        >
                          <MaterialSymbol icon="delete" fontSize={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="msqdx-glass-create-form" style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="msqdx-glass-create-form__header"
                  onClick={() => setKnowledgeFormExpanded(!knowledgeFormExpanded)}
                >
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: 0 }}>Neuer Knowledge Eintrag</h3>
                  <MaterialSymbol 
                    icon={knowledgeFormExpanded ? "expand_less" : "expand_more"} 
                    fontSize={20} 
                  />
                </button>
                {knowledgeFormExpanded && (
                  <form onSubmit={handleKnowledgeSubmit} className="msqdx-glass-create-form__content">
                    <div className="msqdx-glass-field">
                      <label>Titel</label>
                      <input
                        value={knowledgeForm.title}
                        onChange={(event) => handleKnowledgeField("title", event.target.value)}
                        placeholder="Titel"
                      />
                    </div>
                    <div className="msqdx-glass-field">
                      <label>Inhalt</label>
                      <textarea
                        value={knowledgeForm.content}
                        onChange={(event) => handleKnowledgeField("content", event.target.value)}
                        placeholder="Inhalt"
                        rows={3}
                      />
                    </div>
                    <button
                      className="msqdx-glass-button --ghost"
                      type="submit"
                      disabled={knowledgePending}
                      style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                    >
                      <MaterialSymbol icon="add" fontSize={14} />{" "}
                      {knowledgePending ? "Adding..." : "Add"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="msqdx-glass-detail__section">
              <h3 style={{ fontSize: "1.5rem", fontWeight: 100, marginBottom: "2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Dokumente ({documents.length})
                {documents.some((doc) => doc.ingestionStatus === "pending" || doc.ingestionStatus === "processing") && (
                  <span className="msqdx-glass-muted" style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px", marginLeft: "0.5rem", fontWeight: 400, textTransform: "none" }}>
                    <MaterialSymbol icon="sync" fontSize={14} style={{ animation: "spin 2s linear infinite" }} />
                    Updating...
                  </span>
                )}
              </h3>
              {documents.length === 0 && <p className="msqdx-glass-empty">No documents uploaded.</p>}
              {documents.length > 0 && (
                <div className="msqdx-glass-list">
                  {documents.map((doc) => {
                    const ingestionChip = doc.ingestionStatus
                      ? doc.ingestionStatus === "completed"
                        ? { label: "INDEXED", className: "msqdx-glass-chip --published" }
                        : doc.ingestionStatus === "processing"
                          ? { label: `PROCESSING ${doc.ingestionProgress ? Math.round(doc.ingestionProgress) : 0}%`, className: "msqdx-glass-chip --pending" }
                          : doc.ingestionStatus === "failed"
                            ? { label: "ERROR", className: "msqdx-glass-chip --error" }
                            : { label: "PENDING", className: "msqdx-glass-chip --pending" }
                      : null;
                    return (
                      <div key={doc.id} className="msqdx-glass-list-item">
                        <div className="msqdx-glass-list-item__row">
                          <strong>{doc.filename}</strong>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            {ingestionChip && <span className={ingestionChip.className}>{ingestionChip.label}</span>}
                          </div>
                        </div>
                        {doc.ingestionStatus === "processing" && doc.ingestionProgress !== null && (
                          <div style={{ marginTop: "0.5rem" }}>
                            <div style={{ width: "100%", height: "4px", backgroundColor: "var(--color-neutral)", borderRadius: "2px", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${doc.ingestionProgress}%`,
                                  height: "100%",
                                  backgroundColor: "var(--color-theme-accent)",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="msqdx-glass-create-form" style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className={clsx("msqdx-glass-create-form__header", documentUploadExpanded && "--expanded")}
                  onClick={() => setDocumentUploadExpanded(!documentUploadExpanded)}
                  disabled={documentUploadPending}
                >
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: 0 }}>
                    {documentUploadPending ? "Uploading..." : "Upload Document"}
                  </h3>
                  <MaterialSymbol 
                    icon={documentUploadExpanded ? "expand_less" : "expand_more"} 
                    fontSize={20} 
                  />
                </button>
                {documentUploadExpanded && (
                  <div className="msqdx-glass-create-form__content">
                    <div style={{ padding: "1rem", border: "1px dashed var(--color-theme-accent)", borderRadius: "8px", textAlign: "center" }}>
                      <MaterialSymbol icon="upload_file" fontSize={32} style={{ color: "var(--color-theme-accent)", marginBottom: "0.5rem" }} />
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>
                        PDF, DOCX, PPTX, MP3 — Drag file here or click to select
                      </p>
                      <button
                        type="button"
                        className="msqdx-glass-button --ghost"
                        onClick={triggerDocumentUpload}
                        style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                      >
                        <MaterialSymbol icon="upload" fontSize={14} /> Select File
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                    setDocumentUploadExpanded(false);
                  }
                }}
              />
            </div>

            <div className="msqdx-glass-detail__section">
              <MsqdxGlassKnowledgeExplorer targetGroupId={selectedId || ""} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

