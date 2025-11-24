"use client";

import type { ChangeEvent, FormEvent } from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import clsx from "clsx";

import type { PersonaListItem, PersonaListResponse, PersonaResponse } from "@udg-glass/types";

import { MaterialSymbol } from "./material-symbol";
import {
  UdgGlassPersonaBasicsCard,
  UdgGlassBioCard,
  UdgGlassPersonalityCard,
  UdgGlassPainPointsGoalsCard,
  UdgGlassCommunicationCard,
  UdgGlassKnowledgeSourcesCard,
  UdgGlassAdvancedCard
} from "./dashboard-cards";

type UdgGlassPersonaAdminPanelProps = {
  initialList: PersonaListResponse;
  docsUrl: string;
};

type EditFormState = {
  name: string;
  headline: string;
  segment: string;
  status: string;
  updatedBy: string;
};

type CreateFormState = {
  projectId: string;
  name: string;
  segment: string;
  headline: string;
};

type KnowledgeFormState = {
  title: string;
  content: string;
};

const statusChips: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "udg-glass-chip --draft" },
  published: { label: "Published", className: "udg-glass-chip --published" },
  archived: { label: "Archived", className: "udg-glass-chip --archived" },
};

const defaultEditFormState: EditFormState = {
  name: "",
  headline: "",
  segment: "",
  status: "draft",
  updatedBy: "persona-admin-ui",
};

const defaultCreateFormState: CreateFormState = {
  projectId: "",
  name: "",
  segment: "",
  headline: "",
};

const defaultKnowledgeForm: KnowledgeFormState = {
  title: "",
  content: "",
};

const personaBackendPublicBase = process.env.NEXT_PUBLIC_PERSONA_BACKEND_URL?.replace(/\/$/, "") ?? "";

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

  const existingToasts = document.querySelectorAll(".udg-glass-toast");
  existingToasts.forEach((toast) => toast.remove());

  const toast = document.createElement("div");
  toast.className = "udg-glass-toast";
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

export const UdgGlassPersonaAdminPanel = ({ initialList, docsUrl }: UdgGlassPersonaAdminPanelProps) => {
  const [list, setList] = useState<PersonaListResponse>(initialList);
  const [selectedId, setSelectedId] = useState<string | null>(initialList.items[0]?.id ?? null);
  const [detail, setDetail] = useState<PersonaResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<EditFormState>(defaultEditFormState);
  const [savePending, setSavePending] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateFormState);
  const [createPending, setCreatePending] = useState(false);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [documentUploadPending, setDocumentUploadPending] = useState(false);
  const [avatarUploadPending, setAvatarUploadPending] = useState(false);
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormState>(defaultKnowledgeForm);
  const [knowledgePending, setKnowledgePending] = useState(false);
  const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(
    new Set([
      "persona-basics",
      "bio-demographics",
      "personality-values",
      "pain-points-goals",
      "communication",
      "knowledge-sources",
      "advanced"
    ])
  );
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const selectedListItem: PersonaListItem | undefined = useMemo(
    () => list.items.find((item) => item.id === selectedId),
    [list.items, selectedId]
  );

  const loadDetail = useCallback(
    async (personaId: string) => {
      if (!personaId || personaId === "undefined") {
        setDetail(null);
        setDetailError("No valid persona selected.");
        return;
      }
      setDetailError(null);
      setDetailLoading(true);
      try {
        const response = await fetch(`/api/persona-admin/${personaId}`, { cache: "no-store" });
        if (!response.ok) {
          const detailText = await response.text().catch(() => "");
          setDetail(null);
          setDetailError(detailText ? `${response.status}: ${detailText}` : `Backend responded with ${response.status}`);
          return;
        }
        const payload = (await response.json()) as PersonaResponse;
        setDetail(payload);
      } catch (error) {
        console.error("Persona detail load failed", error);
        setDetail(null);
        setDetailError("Could not load persona.");
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  const refreshList = useCallback(async () => {
    setListRefreshing(true);
    try {
      const response = await fetch("/api/persona-admin", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      const payload = (await response.json()) as PersonaListResponse;
      setList(payload);
      if (!payload.items.find((item) => item.id === selectedId)) {
        setSelectedId(payload.items[0]?.id ?? null);
      }
      notify("Persona list updated");
    } catch (error) {
      console.error("Persona list refresh failed", error);
      notify("Update failed");
    } finally {
      setListRefreshing(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  // Auto-refresh ingestion status for documents that are pending or processing
  useEffect(() => {
    if (!detail || !selectedId) return;

    const hasActiveIngestion = detail.documents.some(
      (doc) => doc.ingestionStatus === "pending" || doc.ingestionStatus === "processing"
    );

    if (!hasActiveIngestion) return;

    const interval = setInterval(() => {
      loadDetail(selectedId);
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [detail, selectedId, loadDetail]);

  useEffect(() => {
    if (!detail) {
      setEditForm(defaultEditFormState);
      return;
    }
    setEditForm({
      name: detail.profile.name,
      headline: detail.profile.headline,
      segment: detail.profile.segment,
      status: detail.metadata.status,
      updatedBy: detail.metadata.updatedBy ?? "persona-admin-ui",
    });
  }, [detail]);

  const handleEditField = (field: keyof EditFormState, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!selectedId || !detail) {
      return;
    }
    setSavePending(true);
    try {
      const payload = {
        name: editForm.name,
        headline: editForm.headline,
        segment: editForm.segment,
        status: editForm.status,
        updated_by: editForm.updatedBy || "persona-admin-ui",
        profile: {
          ...detail.profile,
          name: editForm.name,
          headline: editForm.headline,
          segment: editForm.segment,
        },
      };
      const response = await fetch(`/api/persona-admin/${selectedId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      const updated = (await response.json()) as PersonaResponse;
      setDetail(updated);
      setList((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === updated.metadata.personaId ? { ...item, ...updated.metadata, headline: updated.profile.headline } : item)),
      }));
      notify("Persona saved");
    } catch (error) {
      console.error("Persona save failed", error);
      notify("Save failed");
    } finally {
      setSavePending(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.projectId || !createForm.name) {
      notify("Project ID and Name are required.");
      return;
    }
    setCreatePending(true);
    try {
      const payload = {
        project_id: createForm.projectId,
        name: createForm.name,
        segment: createForm.segment || "unspecified",
        headline: createForm.headline || "New Persona",
        profile: {
          id: "",
          name: createForm.name,
          segment: createForm.segment || "unspecified",
          headline: createForm.headline || "New Persona",
          bio: "",
          traits: {},
          pain_points: [],
          goals: [],
          communication_style: {
            vocabulary: [],
            sentence_structure: "",
            skepticism_level: 0,
          },
          confidence: 0.7,
          version: "1.0.0",
          created_at: new Date().toISOString(),
        },
        confidence: 0.7,
        version: "1.0.0",
        updated_by: "persona-admin-ui",
      };
      const response = await fetch("/api/persona-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      await refreshList();
      setCreateForm(defaultCreateFormState);
      notify("Persona created");
    } catch (error) {
      console.error("Persona creation failed", error);
      notify("Creation failed");
    } finally {
      setCreatePending(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedId) {
      return;
    }
    setSavePending(true);
    try {
      const response = await fetch(`/api/persona-admin/${selectedId}?actor=persona-admin-ui`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      await refreshList();
      notify("Persona archived");
    } catch (error) {
      console.error("Persona archive failed", error);
      notify("Archiving failed");
    } finally {
      setSavePending(false);
    }
  };

  const handleDocumentInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedId) {
      return;
    }
    setDocumentUploadPending(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("uploaded_by", "persona-admin-ui");
      const target = personaBackendPublicBase
        ? `${personaBackendPublicBase}/personas/${selectedId}/documents`
        : `/api/persona-admin/${selectedId}/documents`;
      const response = await fetch(target, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
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

  const handleAvatarInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedId) {
      return;
    }
    setAvatarUploadPending(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("updated_by", "persona-admin-ui");
      const target = personaBackendPublicBase
        ? `${personaBackendPublicBase}/personas/${selectedId}/avatar`
        : `/api/persona-admin/${selectedId}/avatar`;
      const response = await fetch(target, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      const payload = (await response.json()) as PersonaResponse;
      setDetail(payload);
      notify("Avatar updated");
    } catch (error) {
      console.error("Avatar upload failed", error);
      notify("Failed to update avatar");
    } finally {
      setAvatarUploadPending(false);
    }
  };

  const triggerAvatarUpload = () => {
    avatarInputRef.current?.click();
  };

  const toggleAccordion = (accordionId: string) => {
    setExpandedAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(accordionId)) {
        next.delete(accordionId);
      } else {
        next.add(accordionId);
      }
      return next;
    });
  };

  const isAccordionExpanded = (accordionId: string) => expandedAccordions.has(accordionId);

  const handleKnowledgeField = (field: keyof KnowledgeFormState, value: string) => {
    setKnowledgeForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleKnowledgeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || !knowledgeForm.title || !knowledgeForm.content) {
      notify("Titel und Inhalt sind Pflicht.");
      return;
    }
    setKnowledgePending(true);
    try {
      const payload = {
        title: knowledgeForm.title,
        content: knowledgeForm.content,
        created_by: "persona-admin-ui",
      };
      const target = personaBackendPublicBase
        ? `${personaBackendPublicBase}/personas/${selectedId}/knowledge`
        : `/api/persona-admin/${selectedId}/knowledge`;
      const response = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      await loadDetail(selectedId);
      setKnowledgeForm(defaultKnowledgeForm);
      notify("Wissenseintrag hinzugefügt");
    } catch (error) {
      console.error("Knowledge add failed", error);
      notify("Failed to save knowledge");
    } finally {
      setKnowledgePending(false);
    }
  };

  return (
    <div className="udg-glass-admin-grid">
      <section className="udg-glass-panel">
        <header className="udg-glass-panel__header">
          <div>
            <h2>Personas</h2>
            <p>{list.total} entries</p>
          </div>
          <button className="udg-glass-button --ghost" onClick={refreshList} disabled={listRefreshing}>
            <MaterialSymbol icon="refresh" fontSize={18} /> Refresh
          </button>
        </header>
        <div className="udg-glass-list">
          {list.items.length === 0 && <p className="udg-glass-empty">No personas available yet.</p>}
          {list.items.map((item) => {
            const chip = statusChips[item.status] ?? statusChips.draft;
            return (
              <button
                key={item.id}
                className={clsx("udg-glass-list-item", selectedId === item.id && "is-active")}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="udg-glass-list-item__row">
                  <strong>{item.name}</strong>
                  <span className={chip.className}>{chip.label}</span>
                </div>
                <p className="udg-glass-list-item__meta">
                  {item.segment} · Version {item.version}
                </p>
                <p className="udg-glass-list-item__meta">Last updated {formatDate(item.updatedAt)}</p>
              </button>
            );
          })}
        </div>
        <div className="udg-glass-create-form">
          <h3>New Persona</h3>
          <div className="udg-glass-field">
            <label>Project ID</label>
            <input value={createForm.projectId} onChange={(event) => setCreateForm((prev) => ({ ...prev, projectId: event.target.value }))} placeholder="123e4567-e89b-12d3-a456-426614174000" />
          </div>
          <div className="udg-glass-field">
            <label>Name</label>
            <input value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Persona Name" />
          </div>
          <div className="udg-glass-field">
            <label>Segment</label>
            <input value={createForm.segment} onChange={(event) => setCreateForm((prev) => ({ ...prev, segment: event.target.value }))} placeholder="B2B / Enterprise / etc." />
          </div>
          <div className="udg-glass-field">
            <label>Headline</label>
            <input value={createForm.headline} onChange={(event) => setCreateForm((prev) => ({ ...prev, headline: event.target.value }))} placeholder="Kurzbeschreibung" />
          </div>
          <button className="udg-glass-button" onClick={handleCreate} disabled={createPending}>
            <MaterialSymbol icon="add" fontSize={18} /> Persona anlegen
          </button>
        </div>
      </section>

      <section className="udg-glass-panel">
        {!selectedId && <p className="udg-glass-empty">Please select a persona.</p>}
        {selectedId && detailLoading && <p className="udg-glass-muted">Lade Persona...</p>}
        {detailError && <p className="udg-glass-error">{detailError}</p>}
        {detail && (
          <div className="udg-glass-detail">
            <input ref={documentInputRef} type="file" className="udg-glass-sr-only" onChange={handleDocumentInputChange} />
            <input ref={avatarInputRef} type="file" className="udg-glass-sr-only" accept="image/*" onChange={handleAvatarInputChange} />
            <header className="udg-glass-detail__header">
              <div className="udg-glass-detail__title">
                <div className="udg-glass-avatar">
                  {detail.metadata.avatarUrl ? (
                    <img src={detail.metadata.avatarUrl} alt={`${detail.profile.name} Avatar`} />
                  ) : (
                    <MaterialSymbol icon="person" fontSize={32} />
                  )}
                </div>
                <div>
                  <h2>{detail.profile.name}</h2>
                  <p>{detail.profile.headline}</p>
                  <div className="udg-glass-detail__links">
                    <button className="udg-glass-button --ghost" onClick={triggerAvatarUpload} disabled={avatarUploadPending}>
                      <MaterialSymbol icon="photo_camera" fontSize={16} /> {avatarUploadPending ? "Uploading..." : "Change avatar"}
                    </button>
                    <a className="udg-glass-button --ghost" href={detail.metadata.consoleUrl} target="_blank" rel="noreferrer">
                      <MaterialSymbol icon="open_in_new" fontSize={16} /> Console
                    </a>
                    {detail.metadata.graphUrl && (
                      <a className="udg-glass-button --ghost" href={detail.metadata.graphUrl} target="_blank" rel="noreferrer">
                        <MaterialSymbol icon="hub" fontSize={16} /> Neo4j
                      </a>
                    )}
                    {detail.metadata.graphBloomUrl && (
                      <a className="udg-glass-button --ghost" href={detail.metadata.graphBloomUrl} target="_blank" rel="noreferrer">
                        <MaterialSymbol icon="public" fontSize={16} /> Bloom
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </header>

            {/* Dashboard Cards Grid */}
            <div className="udg-glass-dashboard-grid">
              {/* Card: Persona-Grundlagen - Full Width */}
              <UdgGlassPersonaBasicsCard
                detail={detail}
                editForm={editForm}
                expanded={isAccordionExpanded("persona-basics")}
                onToggle={toggleAccordion}
                onEditField={handleEditField}
                onSave={handleSave}
                onArchive={handleArchive}
                savePending={savePending}
                formatDate={formatDate}
              />

              {/* Card: Biografie & Demographie */}
              {(detail.profile.bio || (detail.profile as any).full_name || (detail.profile as any).age || (detail.profile as any).location) && (
                <UdgGlassBioCard
                  profile={detail.profile}
                  expanded={isAccordionExpanded("bio-demographics")}
                  onToggle={toggleAccordion}
                />
              )}

              {/* Card: Persönlichkeit & Werte - 50% width */}
              {(Object.keys(detail.profile.traits || {}).length > 0 || 
                ((detail.profile as any).interests && (detail.profile as any).interests.length > 0) ||
                ((detail.profile as any).values && (detail.profile as any).values.length > 0) ||
                ((detail.profile as any).social_media_usage && (detail.profile as any).social_media_usage.length > 0)) && (
                <UdgGlassPersonalityCard
                  profile={detail.profile}
                  expanded={isAccordionExpanded("personality-values")}
                  onToggle={toggleAccordion}
                />
              )}

              {/* Card: Kommunikation - 50% width (nebeneinander mit Personality) */}
              {detail.profile.communication_style && (
                <UdgGlassCommunicationCard
                  profile={detail.profile}
                  expanded={isAccordionExpanded("communication")}
                  onToggle={toggleAccordion}
                />
              )}

              {/* Card: Pain Points & Goals - Full Width, zweispaltig */}
              {((detail.profile.pain_points && detail.profile.pain_points.length > 0) ||
                (detail.profile.goals && detail.profile.goals.length > 0)) && (
                <UdgGlassPainPointsGoalsCard
                  profile={detail.profile}
                  expanded={isAccordionExpanded("pain-points-goals")}
                  onToggle={toggleAccordion}
                />
              )}

              {/* Card: Knowledge & Sources - Full Width */}
              <UdgGlassKnowledgeSourcesCard
                detail={detail}
                knowledgeForm={knowledgeForm}
                documentUploadPending={documentUploadPending}
                knowledgePending={knowledgePending}
                selectedId={selectedId}
                expanded={isAccordionExpanded("knowledge-sources")}
                onToggle={toggleAccordion}
                onDocumentUpload={triggerDocumentUpload}
                onKnowledgeField={handleKnowledgeField}
                onKnowledgeSubmit={handleKnowledgeSubmit}
                onLoadDetail={loadDetail}
                formatDate={formatDate}
                notify={notify}
                personaBackendPublicBase={personaBackendPublicBase}
              />

              {/* Card: Erweitert */}
              <UdgGlassAdvancedCard
                profile={detail.profile}
                expanded={isAccordionExpanded("advanced")}
                onToggle={toggleAccordion}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

UdgGlassPersonaAdminPanel.displayName = "udg-glass-persona-admin-panel";

