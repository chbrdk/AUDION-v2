"use client";

import type { ChangeEvent, FormEvent } from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PersonaListItem, PersonaListResponse, PersonaProfile, PersonaResponse } from "@msqdx-glass/types";

import { MsqdxIcon, MsqdxButton, MsqdxTypography, MsqdxCard, MsqdxFormField, MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassAiButtonIcon } from "./generic/msqdx-glass-ai-button-icon";
import {
  MsqdxGlassBioCard,
  MsqdxGlassBioCardEdit,
  MsqdxGlassPersonalityCard,
  MsqdxGlassPainPointsGoalsCard,
  MsqdxGlassCommunicationCard,
  MsqdxGlassKnowledgeSourcesCard,
  MsqdxGlassAdvancedCard,
} from "./dashboard-cards";
import { MsqdxGlassFieldEditor, MsqdxGlassEditButton } from "./generic";
import { getFieldDefinitions } from "@msqdx-glass/types";
import { useAiAssist } from "../hooks/use-ai-assist";
import { MsqdxGlassCollapsiblePanel } from "./admin/msqdx-glass-collapsible-panel";
import {
  Alert,
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  TextField,
  Tooltip,
} from "@mui/material";
import { mirrorFillStringPair } from "../lib/bilingual-mirror";
import { translatePersonaAdminFields } from "../lib/persona-translate-fields";
import { buildApiUrl } from "../app/api/_lib/backend";
import { normalizePersonaListResponse } from "../lib/persona-list-normalize";
import { THEME_ACCENT } from "../lib/theme-accent";
import { sortMoodboardTiles } from "../lib/moodboard";
import {
  moodboardCategoryMoodLine,
  moodboardGridContainerSx,
  moodboardTileCardRadius,
  moodboardTileGridSx,
} from "../lib/moodboard-tile-ui";
import { useProject } from "./projects/project-provider";
import { useI18n } from "./i18n/i18n-provider";
import { targetGroupsApi, type TargetGroupResponse } from "../app/api/_lib/target-groups";

type MsqdxGlassPersonaAdminPanelProps = {
  initialList: PersonaListResponse;
  docsUrl: string;
  mode?: "full" | "detail";
  activePersonaId?: string | null;
};

type EditFormState = {
  name: string;
  headline: string;
  headline_de: string;
  segment: string;
  status: string;
  updatedBy: string;
};

type CreateFormState = {
  name: string;
  segment: string;
  headline: string;
};

type KnowledgeFormState = {
  title: string;
  content: string;
};

type MoodboardTile = {
  id: string;
  moodboardId: string;
  category: string;
  imageUrl: string;
  thumbUrl?: string | null;
  sourceType?: string;
  sourceUrl?: string | null;
  author?: string | null;
  license?: string | null;
  attributionText?: string | null;
  caption?: string | null;
  rationale?: string | null;
  tags?: string[];
  order: number;
  locked: boolean;
};

type Moodboard = {
  id: string;
  personaId: string;
  title: string;
  status: string;
  active: boolean;
  styleKeywords?: string[];
  tiles: MoodboardTile[];
};

type PersonaSaveUpdates =
  | Partial<EditFormState>
  | Partial<PersonaProfile>
  | { project_id?: string; target_group_id?: string | null }
  | { profile_de?: Record<string, unknown> | null };

type PersonaSaveOptions = {
  premergedProfile?: PersonaProfile;
  premergedProfileDe?: Record<string, unknown> | null;
};

const defaultEditFormState: EditFormState = {
  name: "",
  headline: "",
  headline_de: "",
  segment: "",
  status: "draft",
  updatedBy: "persona-admin-ui",
};

const defaultCreateFormState: CreateFormState = {
  name: "",
  segment: "",
  headline: "",
};

const defaultKnowledgeForm: KnowledgeFormState = {
  title: "",
  content: "",
};

/** Avoid Mixed Content: use same-origin proxy when API returns http/localhost and page is HTTPS. */
function safeAvatarSrc(avatarUrl: string | null | undefined, personaId: string | undefined): string | undefined {
  if (!avatarUrl || !personaId) return avatarUrl ?? undefined;
  if (avatarUrl.startsWith("data:")) return avatarUrl;
  if (typeof window !== "undefined" && window.location.protocol === "https:" && (avatarUrl.startsWith("http://") || avatarUrl.includes("localhost"))) {
    return buildApiUrl(`/api/persona-admin/${personaId}/avatar`);
  }
  return avatarUrl;
}

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
  existingToasts.forEach((toast) => toast.remove());

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

export const MsqdxGlassPersonaAdminPanel = ({
  initialList,
  docsUrl,
  mode = "full",
  activePersonaId = null,
}: MsqdxGlassPersonaAdminPanelProps) => {
  const { activeProjectId, activeProject, projects } = useProject();
  const { t, locale } = useI18n();
  const accent = "var(--color-theme-accent)";

  const [list, setList] = useState<PersonaListResponse>(() => normalizePersonaListResponse(initialList));
  const [selectedId, setSelectedId] = useState<string | null>(activePersonaId ?? initialList.items[0]?.id ?? null);
  const [detail, setDetail] = useState<PersonaResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<EditFormState>(defaultEditFormState);
  const [savePending, setSavePending] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateFormState);
  const [createPending, setCreatePending] = useState(false);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [documentUploadPending, setDocumentUploadPending] = useState(false);
  const [avatarGeneratePending, setAvatarGeneratePending] = useState(false);
  const [enrichPending, setEnrichPending] = useState(false);
  const [ensureChatPromptPending, setEnsureChatPromptPending] = useState(false);
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormState>(defaultKnowledgeForm);
  const [knowledgePending, setKnowledgePending] = useState(false);
  const { execute: runPersonaAiAssist, loading: personaAiLoading } = useAiAssist();
  const [personaAiError, setPersonaAiError] = useState<string | null>(null);
  const [recentTraitHighlights, setRecentTraitHighlights] = useState<string[]>([]);
  const [recentVocabularyHighlights, setRecentVocabularyHighlights] = useState<string[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(
    new Set([
      "persona-basics",
      "bio-demographics",
      "personality-traits",
      "personality-interests",
      "personality-values",
      "pain-points-goals",
      "communication",
      "advanced",
    ])
  );
  const [targetGroupsForMetadata, setTargetGroupsForMetadata] = useState<TargetGroupResponse[]>([]);
  const [metadataAssignPending, setMetadataAssignPending] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moodboard, setMoodboard] = useState<Moodboard | null>(null);
  const [moodboardLoading, setMoodboardLoading] = useState(false);
  const [moodboardPending, setMoodboardPending] = useState(false);
  const [moodboardError, setMoodboardError] = useState<string | null>(null);
  const [tileDialogOpen, setTileDialogOpen] = useState(false);
  const [activeTile, setActiveTile] = useState<MoodboardTile | null>(null);
  const [tileEditCaption, setTileEditCaption] = useState("");
  const [tileEditRationale, setTileEditRationale] = useState("");
  const [tileEditLocked, setTileEditLocked] = useState(false);
  const [tileSavePending, setTileSavePending] = useState(false);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const lastTargetGroupsProjectIdRef = useRef<string | null>(null);
  const loadDetailInFlightRef = useRef(false);
  const loadDetailRef = useRef<(id: string) => Promise<void>>(async () => {});
  const lastLoadedPersonaIdRef = useRef<string | null>(null);
  /** When true, do not overwrite metadata/editForm from background `detail` refreshes (polling, list sync). */
  const metadataFormDirtyRef = useRef(false);

  const selectedListItem: PersonaListItem | undefined = useMemo(
    () => list.items.find((item) => item.id === selectedId),
    [list.items, selectedId]
  );

  const loadDetail = useCallback(
    async (personaId: string) => {
      if (!personaId || personaId === "undefined") {
        setDetail(null);
        setDetailError(t("personaAdmin.noValidPersona"));
        return;
      }
      if (loadDetailInFlightRef.current) return;
      loadDetailInFlightRef.current = true;
      setDetailError(null);
      setDetailLoading(true);
      try {
        const query = activeProjectId ? `?project_id=${encodeURIComponent(activeProjectId)}` : "";
        const response = await fetch(buildApiUrl(`/api/persona-admin/${personaId}${query}`), { cache: "no-store" });
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
        setDetailError(t("personaAdmin.loadFailed"));
      } finally {
        loadDetailInFlightRef.current = false;
        setDetailLoading(false);
      }
    },
    [activeProjectId, t]
  );
  loadDetailRef.current = loadDetail;

  const refreshList = useCallback(async () => {
    if (!activeProjectId) {
      setList({ items: [], total: 0, page: 1, page_size: 50 });
      // Detail mode can be deep-linked without a selected project. Do not clear the route-driven selection,
      // otherwise `selectedId` (route) ↔ `refreshList` (clears when no project) will ping-pong forever.
      if (!(mode === "detail" && activePersonaId)) {
        setSelectedId(null);
        setDetail(null);
      }
      return;
    }
    setListRefreshing(true);
    try {
      const response = await fetch(
        buildApiUrl(`/api/persona-admin?project_id=${encodeURIComponent(activeProjectId)}`),
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      const payload = normalizePersonaListResponse(await response.json());
      setList(payload);
      const currentInList = payload.items.find((item) => item.id === selectedId);
      // On detail page with URL-driven persona, never overwrite selectedId (prevents refreshList ↔ sync effect loop).
      if (!currentInList && !(mode === "detail" && activePersonaId)) {
        setSelectedId(payload.items[0]?.id ?? null);
      }
      notify(t("personaAdmin.toasts.listUpdated"));
    } catch (error) {
      console.error("Persona list refresh failed", error);
      notify(t("personaAdmin.toasts.updateFailed"));
    } finally {
      setListRefreshing(false);
    }
  }, [selectedId, activeProjectId, t, mode, activePersonaId]);

  useEffect(() => {
    void refreshList();
  }, [refreshList, activeProjectId]);

  // Detail page: keep selection in sync with the route.
  useEffect(() => {
    if (mode !== "detail") return;
    if (!activePersonaId) return;
    if (selectedId !== activePersonaId) {
      setSelectedId(activePersonaId);
    }
  }, [mode, activePersonaId, selectedId]);

  // Load detail only when selectedId changes. Use ref so we don't re-run when loadDetail identity changes (would cause request storm).
  // Only trigger load when selectedId actually changed (guards against duplicate effect runs / Strict Mode).
  useEffect(() => {
    if (!selectedId) {
      lastLoadedPersonaIdRef.current = null;
      setDetail(null);
      loadDetailInFlightRef.current = false;
      return;
    }
    if (lastLoadedPersonaIdRef.current === selectedId) return;
    lastLoadedPersonaIdRef.current = selectedId;
    loadDetailInFlightRef.current = false;
    loadDetailRef.current(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!recentTraitHighlights.length) return;
    const timeout = setTimeout(() => setRecentTraitHighlights([]), 5000);
    return () => clearTimeout(timeout);
  }, [recentTraitHighlights]);

  useEffect(() => {
    setRecentTraitHighlights([]);
  }, [selectedId]);

  useEffect(() => {
    if (!recentVocabularyHighlights.length) return;
    const timeout = setTimeout(() => setRecentVocabularyHighlights([]), 5000);
    return () => clearTimeout(timeout);
  }, [recentVocabularyHighlights]);

  useEffect(() => {
    setRecentVocabularyHighlights([]);
  }, [selectedId]);

  // Auto-refresh ingestion status for documents that are pending or processing.
  // Depend only on a boolean so we don't re-run every time detail is replaced (which would retrigger constantly).
  const hasActiveIngestion = useMemo(
    () =>
      Boolean(
        detail?.documents?.some(
          (doc) => doc.ingestionStatus === "pending" || doc.ingestionStatus === "processing"
        )
      ),
    [detail?.documents]
  );
  useEffect(() => {
    if (!selectedId || !hasActiveIngestion) return;
    const interval = setInterval(() => {
      if (!loadDetailInFlightRef.current) loadDetailRef.current(selectedId);
    }, 5000);
    return () => clearInterval(interval);
  }, [hasActiveIngestion, selectedId]);

  useEffect(() => {
    metadataFormDirtyRef.current = false;
  }, [selectedId]);

  const loadMoodboard = useCallback(
    async (personaId: string) => {
      if (!personaId) return;
      setMoodboardLoading(true);
      setMoodboardError(null);
      try {
        const res = await fetch(buildApiUrl(`/api/persona-admin/${personaId}/moodboards/active`), {
          cache: "no-store",
          credentials: "include",
        });
        if (res.status === 404) {
          setMoodboard(null);
          return;
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as Moodboard;
        setMoodboard(data);
      } catch (e) {
        setMoodboardError(e instanceof Error ? e.message : "Failed to load moodboard");
        setMoodboard(null);
      } finally {
        setMoodboardLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedId) return;
    void loadMoodboard(selectedId);
  }, [selectedId, loadMoodboard]);

  const pollMoodboardUntilReady = useCallback(
    (personaId: string) => {
      let tries = 0;
      const maxTries = 30;
      const interval = setInterval(async () => {
        tries += 1;
        await loadMoodboard(personaId);
        if (tries >= maxTries) {
          clearInterval(interval);
        }
      }, 2000);
      return () => clearInterval(interval);
    },
    [loadMoodboard]
  );

  const handleGenerateMoodboard = async () => {
    if (!selectedId) return;
    setMoodboardPending(true);
    setMoodboardError(null);
    try {
      const res = await fetch(buildApiUrl(`/api/persona-admin/${selectedId}/moodboards`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Moodboard", updated_by: "persona-admin-ui" }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.detail || payload?.error || `HTTP ${res.status}`);
      }
      const mb = (payload?.moodboard ?? payload) as Moodboard;
      setMoodboard(mb);
      pollMoodboardUntilReady(selectedId);
    } catch (e) {
      setMoodboardError(e instanceof Error ? e.message : "Failed to generate moodboard");
    } finally {
      setMoodboardPending(false);
    }
  };

  const handleRebuildMoodboard = async () => {
    if (!moodboard?.id) return;
    setMoodboardPending(true);
    setMoodboardError(null);
    try {
      const res = await fetch(buildApiUrl(`/api/persona-admin/moodboards/${moodboard.id}/rebuild`), {
        method: "POST",
        credentials: "include",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.detail || payload?.error || `HTTP ${res.status}`);
      }
      const mb = (payload?.moodboard ?? payload) as Moodboard;
      setMoodboard(mb);
      if (selectedId) pollMoodboardUntilReady(selectedId);
    } catch (e) {
      setMoodboardError(e instanceof Error ? e.message : "Failed to rebuild moodboard");
    } finally {
      setMoodboardPending(false);
    }
  };

  const openTileDialog = (tile: MoodboardTile) => {
    setActiveTile(tile);
    setTileEditCaption(tile.caption ?? "");
    setTileEditRationale(tile.rationale ?? "");
    setTileEditLocked(Boolean(tile.locked));
    setTileDialogOpen(true);
  };

  const handleSaveTile = async () => {
    if (!activeTile) return;
    setTileSavePending(true);
    try {
      const res = await fetch(buildApiUrl(`/api/persona-admin/moodboard-tiles/${activeTile.id}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: tileEditCaption,
          rationale: tileEditRationale,
          locked: tileEditLocked,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.detail || payload?.error || `HTTP ${res.status}`);
      // Refresh the whole board for consistency.
      if (selectedId) await loadMoodboard(selectedId);
      setTileDialogOpen(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to save tile");
    } finally {
      setTileSavePending(false);
    }
  };

  const handleDeleteTile = async (tile: MoodboardTile) => {
    if (!tile?.id) return;
    try {
      const res = await fetch(buildApiUrl(`/api/persona-admin/moodboard-tiles/${tile.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }
      if (selectedId) await loadMoodboard(selectedId);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to delete tile");
    }
  };

  useEffect(() => {
    if (!detail) {
      setEditForm(defaultEditFormState);
      metadataFormDirtyRef.current = false;
      return;
    }
    if (detail.metadata.personaId !== selectedId) {
      return;
    }
    if (metadataFormDirtyRef.current) {
      return;
    }
    setEditForm((prev) => ({
      name: detail.profile.name,
      headline: detail.profile.headline,
      headline_de: detail.headline_de ?? "",
      segment: detail.profile.segment,
      status: detail.metadata.status,
      updatedBy: detail.metadata.updatedBy ?? "persona-admin-ui",
    }));
  }, [detail, selectedId]);

  useEffect(() => {
    const projectId = detail?.metadata?.projectId ?? null;
    if (!projectId) {
      lastTargetGroupsProjectIdRef.current = null;
      setTargetGroupsForMetadata([]);
      return;
    }
    if (lastTargetGroupsProjectIdRef.current === projectId) return;
    lastTargetGroupsProjectIdRef.current = projectId;
    let cancelled = false;
    targetGroupsApi
      .listTargetGroups({ project_id: projectId, page_size: 200 })
      .then((res) => {
        if (!cancelled) setTargetGroupsForMetadata(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setTargetGroupsForMetadata([]);
      });
    return () => {
      cancelled = true;
    };
  }, [detail?.metadata?.projectId]);

  const handleEditField = (field: keyof EditFormState, value: string) => {
    metadataFormDirtyRef.current = true;
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveMetadataAssignment = async (updates: {
    project_id?: string;
    target_group_id?: string | null;
    tavus_replica_id?: string | null;
    tavus_persona_id?: string | null;
  }) => {
    if (!selectedId || !detail) return;
    setMetadataAssignPending(true);
    try {
      await handleSave(updates);
      notify(t("personaAdmin.toasts.personaSaved"));
    } catch {
      notify(t("personaAdmin.toasts.saveFailed"));
    } finally {
      setMetadataAssignPending(false);
    }
  };

  const handleSave = async (updates?: PersonaSaveUpdates, saveOptions?: PersonaSaveOptions) => {
    if (!selectedId || !detail) {
      return;
    }
    setSavePending(true);
    try {
      const usePremerged = Boolean(saveOptions?.premergedProfile);

      // Check if updates contain demographic fields (PersonaProfile fields)
      const hasDemographicFields =
        !usePremerged &&
        updates &&
        ('age' in updates ||
        'location' in updates ||
        'gender' in updates ||
        'media_affinity' in updates ||
        'full_name' in updates ||
        'bio' in updates ||
        'interests' in updates ||
        'values' in updates ||
        'traits' in updates ||
        'communication_style' in updates ||
        'pain_points' in updates ||
        'goals' in updates);

      const hasStructuredPatchFields =
        updates &&
        ("profile_de" in updates ||
          "project_id" in updates ||
          "target_group_id" in updates ||
          "tavus_replica_id" in updates ||
          "tavus_persona_id" in updates);

      let formUpdates: Partial<EditFormState> | undefined;
      let demographicUpdates: Partial<PersonaProfile> | undefined;

      if (hasDemographicFields) {
        // Updates are demographic fields
        demographicUpdates = updates as Partial<PersonaProfile>;
      } else if (!hasStructuredPatchFields && updates) {
        // Updates are form fields
        formUpdates = updates as Partial<EditFormState>;
      }

      // Merge basic form updates
      const updatedName = formUpdates?.name ?? editForm.name;
      const updatedHeadline = formUpdates?.headline ?? editForm.headline;
      const updatedHeadlineDe = formUpdates?.headline_de ?? editForm.headline_de;
      const headlinePair = mirrorFillStringPair(updatedHeadline, updatedHeadlineDe);
      const finalHeadline = headlinePair.en;
      const finalHeadlineDe = headlinePair.de.trim() ? headlinePair.de : "";
      const updatedSegment = formUpdates?.segment ?? editForm.segment;
      const updatedStatus = formUpdates?.status ?? editForm.status;
      const updatedBy = formUpdates?.updatedBy ?? editForm.updatedBy ?? "persona-admin-ui";

      let completeProfile: PersonaProfile;

      if (usePremerged && saveOptions?.premergedProfile) {
        completeProfile = {
          ...saveOptions.premergedProfile,
          name: updatedName,
          headline: finalHeadline,
          segment: updatedSegment,
        };
        Object.assign(completeProfile, {
          gender: completeProfile.gender ?? null,
          age: completeProfile.age ?? null,
          location: completeProfile.location ?? null,
          media_affinity: completeProfile.media_affinity ?? null,
          full_name: completeProfile.full_name ?? null,
        });
      } else {
        // Prepare profile updates - preserve existing values and merge new ones
        const profileUpdates: Partial<PersonaProfile> = {
          ...detail.profile,
          name: updatedName,
          headline: finalHeadline,
          segment: updatedSegment,
        };

        // Merge demographic updates (explicitly set values, including null)
        if (demographicUpdates) {
          if ('age' in demographicUpdates) {
            profileUpdates.age = demographicUpdates.age;
          }
          if ('location' in demographicUpdates) {
            profileUpdates.location = demographicUpdates.location ?? null;
          }
          if ('gender' in demographicUpdates) {
            const genderValue = demographicUpdates.gender;
            profileUpdates.gender = (genderValue && genderValue.trim() !== "") ? genderValue : null;
          }
          if ('media_affinity' in demographicUpdates) {
            profileUpdates.media_affinity = demographicUpdates.media_affinity;
          }
          if ('full_name' in demographicUpdates) {
            profileUpdates.full_name = demographicUpdates.full_name ?? null;
          }
          Object.keys(demographicUpdates).forEach((key) => {
            if (!['age', 'location', 'gender', 'media_affinity', 'full_name', 'name', 'headline', 'segment'].includes(key)) {
              const value = demographicUpdates[key as keyof PersonaProfile];
              if (value !== undefined) {
                (profileUpdates as Record<string, unknown>)[key] = value as unknown;
              }
            }
          });
        }

        completeProfile = {
          ...detail.profile,
          name: updatedName,
          headline: finalHeadline,
          segment: updatedSegment,
        };

        const existingGender = detail.profile?.gender;
        const existingAge = detail.profile?.age;
        const existingLocation = detail.profile?.location;
        const existingMediaAffinity = detail.profile?.media_affinity;
        const existingFullName = detail.profile?.full_name;

        completeProfile.gender = completeProfile.gender ?? existingGender ?? null;
        completeProfile.age = completeProfile.age ?? existingAge ?? null;
        completeProfile.location = completeProfile.location ?? existingLocation ?? null;
        completeProfile.media_affinity = completeProfile.media_affinity ?? existingMediaAffinity ?? null;
        completeProfile.full_name = completeProfile.full_name ?? existingFullName ?? null;

        if (demographicUpdates) {
          if ('age' in demographicUpdates) {
            completeProfile.age = demographicUpdates.age;
          }
          if ('location' in demographicUpdates) {
            completeProfile.location = demographicUpdates.location ?? null;
          }
          if ('gender' in demographicUpdates) {
            const genderValue = demographicUpdates.gender;
            const finalGender = (genderValue && typeof genderValue === 'string' && genderValue.trim() !== "") ? genderValue : null;
            completeProfile.gender = finalGender;
          }
          if ('media_affinity' in demographicUpdates) {
            completeProfile.media_affinity = demographicUpdates.media_affinity;
          }
          if ('full_name' in demographicUpdates) {
            completeProfile.full_name = demographicUpdates.full_name ?? null;
          }
          Object.keys(demographicUpdates).forEach((key) => {
            if (!['age', 'location', 'gender', 'media_affinity', 'full_name', 'name', 'headline', 'segment'].includes(key)) {
              const value = demographicUpdates[key as keyof PersonaProfile];
              if (value !== undefined) {
                (completeProfile as Record<string, unknown>)[key] = value as unknown;
              }
            }
          });
        }

        if (profileUpdates) {
          Object.keys(profileUpdates).forEach((key) => {
            if (!['name', 'headline', 'segment'].includes(key)) {
              const value = profileUpdates[key as keyof PersonaProfile];
              if (value !== undefined) {
                (completeProfile as Record<string, unknown>)[key] = value as unknown;
              }
            }
          });
        }

        if (!('gender' in completeProfile)) {
          completeProfile.gender = detail.profile?.gender ?? null;
        }
        if (!('age' in completeProfile)) {
          completeProfile.age = detail.profile?.age ?? null;
        }
        if (!('location' in completeProfile)) {
          completeProfile.location = detail.profile?.location ?? null;
        }
        if (!('media_affinity' in completeProfile)) {
          completeProfile.media_affinity = detail.profile?.media_affinity ?? null;
        }
        if (!('full_name' in completeProfile)) {
          completeProfile.full_name = detail.profile?.full_name ?? null;
        }

        Object.assign(completeProfile, {
          gender: completeProfile.gender ?? null,
          age: completeProfile.age ?? null,
          location: completeProfile.location ?? null,
          media_affinity: completeProfile.media_affinity ?? null,
          full_name: completeProfile.full_name ?? null,
        });
      }

      let profileDe: Record<string, unknown> | null | undefined = undefined;
      if (usePremerged && saveOptions?.premergedProfileDe !== undefined) {
        profileDe = saveOptions.premergedProfileDe;
      } else if (updates && "profile_de" in updates) {
        profileDe = (updates as { profile_de?: Record<string, unknown> | null }).profile_de ?? null;
      }

      const payload: Record<string, unknown> = {
        name: updatedName,
        headline: finalHeadline,
        headline_de: finalHeadlineDe.trim() ? finalHeadlineDe : null,
        segment: updatedSegment,
        status: updatedStatus,
        updated_by: updatedBy,
        profile: completeProfile,
      };
      if (profileDe !== undefined) {
        payload.profile_de = profileDe;
      }
      if (detail.metadata) {
        payload.project_id = (updates as { project_id?: string })?.project_id ?? detail.metadata.projectId;
        payload.target_group_id = (updates as { target_group_id?: string | null })?.target_group_id !== undefined
          ? (updates as { target_group_id?: string | null }).target_group_id
          : (detail.metadata.targetGroupId ?? null);
        payload.tavus_replica_id =
          (updates as { tavus_replica_id?: string | null })?.tavus_replica_id !== undefined
            ? (updates as { tavus_replica_id?: string | null }).tavus_replica_id ?? null
            : (detail.metadata as { tavusReplicaId?: string | null }).tavusReplicaId ?? null;
        payload.tavus_persona_id =
          (updates as { tavus_persona_id?: string | null })?.tavus_persona_id !== undefined
            ? (updates as { tavus_persona_id?: string | null }).tavus_persona_id ?? null
            : (detail.metadata as { tavusPersonaId?: string | null }).tavusPersonaId ?? null;
      }

      // Update local form state if we have form updates
      if (formUpdates) {
        if (formUpdates.name !== undefined) handleEditField("name", formUpdates.name);
        if (formUpdates.headline !== undefined) handleEditField("headline", formUpdates.headline);
        if (formUpdates.headline_de !== undefined) handleEditField("headline_de", formUpdates.headline_de);
        if (formUpdates.segment !== undefined) handleEditField("segment", formUpdates.segment);
        if (formUpdates.status !== undefined) handleEditField("status", formUpdates.status);
        if (formUpdates.updatedBy !== undefined) handleEditField("updatedBy", formUpdates.updatedBy);
      }

      const response = await fetch(buildApiUrl(`/api/persona-admin/${selectedId}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error("Persona save failed:", response.status, errorText);
        throw new Error(`Backend responded with ${response.status}: ${errorText}`);
      }
      const updated = (await response.json()) as PersonaResponse;
      metadataFormDirtyRef.current = false;
      setDetail(updated);
      setList((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === updated.metadata.personaId ? { ...item, ...updated.metadata, headline: updated.profile.headline } : item)),
      }));

      // Update editForm state if we have form updates
      if (formUpdates) {
        setEditForm((prev) => ({
          ...prev,
          ...(formUpdates.name !== undefined && { name: formUpdates.name }),
          ...(formUpdates.headline !== undefined && { headline: formUpdates.headline }),
          ...(formUpdates.headline_de !== undefined && { headline_de: formUpdates.headline_de }),
          ...(formUpdates.segment !== undefined && { segment: formUpdates.segment }),
          ...(formUpdates.status !== undefined && { status: formUpdates.status }),
          ...(formUpdates.updatedBy !== undefined && { updatedBy: formUpdates.updatedBy }),
        }));
      }

      notify(t("personaAdmin.toasts.personaSaved"));
    } catch (error) {
      console.error("Persona save failed", error);
      notify(t("personaAdmin.toasts.saveFailed"));
    } finally {
      setSavePending(false);
    }
  };

  const profileForBioEditor = useMemo((): PersonaProfile | null => {
    if (!detail) return null;
    const en = detail.profile;
    if (locale !== "de") return en;
    const raw = detail.profile_de;
    const de =
      raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Partial<PersonaProfile>) : {};
    return {
      ...en,
      bio: typeof de.bio === "string" ? de.bio : en.bio,
      full_name: de.full_name !== undefined && de.full_name !== null ? (de.full_name as string | null) : en.full_name,
      location: typeof de.location === "string" ? de.location : en.location,
      age: typeof de.age === "number" ? de.age : en.age,
      gender: de.gender != null && String(de.gender).trim() !== "" ? (de.gender as string) : en.gender,
      media_affinity: typeof de.media_affinity === "number" ? de.media_affinity : en.media_affinity,
    };
  }, [detail, locale]);

  const handleBioDemographicsBilingualSave = async (updates: Partial<PersonaProfile>) => {
    if (!selectedId || !detail) return;
    const stringKeys = ["bio", "location", "full_name"] as const;
    const toTranslate: Record<string, string> = {};
    for (const k of stringKeys) {
      if (k in updates && updates[k] !== undefined) {
        const v = updates[k];
        toTranslate[k] = typeof v === "string" ? v : v == null ? "" : String(v);
      }
    }
    const filtered = Object.fromEntries(Object.entries(toTranslate).filter(([, v]) => v.trim().length > 0));

    const baseDe =
      detail.profile_de && typeof detail.profile_de === "object" && !Array.isArray(detail.profile_de)
        ? { ...(detail.profile_de as Record<string, unknown>) }
        : ({} as Record<string, unknown>);

    let nextEn: PersonaProfile = { ...detail.profile };
    let nextDe: Record<string, unknown> = baseDe;

    const applyNumericShared = () => {
      if ("age" in updates && updates.age !== undefined) {
        nextEn.age = updates.age;
        nextDe.age = updates.age;
      }
      if ("gender" in updates) {
        const g = updates.gender;
        const finalG = g && String(g).trim() !== "" ? String(g) : null;
        nextEn.gender = finalG;
        nextDe.gender = finalG;
      }
      if ("media_affinity" in updates && updates.media_affinity !== undefined) {
        nextEn.media_affinity = updates.media_affinity;
        nextDe.media_affinity = updates.media_affinity;
      }
    };

    try {
      if (locale === "en") {
        nextEn = { ...nextEn, ...updates };
        applyNumericShared();
        if (Object.keys(filtered).length > 0) {
          const { strings } = await translatePersonaAdminFields(selectedId, { fromLocale: "en", strings: filtered });
          nextDe = { ...nextDe, ...strings };
        }
      } else {
        nextDe = { ...nextDe, ...updates };
        applyNumericShared();
        if (Object.keys(filtered).length > 0) {
          const { strings } = await translatePersonaAdminFields(selectedId, { fromLocale: "de", strings: filtered });
          nextEn = { ...nextEn, ...strings };
        }
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : t("personaAdmin.toasts.saveFailed"));
      return;
    }

    for (const k of stringKeys) {
      if (!(k in updates)) continue;
      const cleared = updates[k] === null || updates[k] === "";
      if (!cleared) continue;
      if (k === "bio") {
        nextEn.bio = "";
        nextDe.bio = "";
      } else {
        const empty = updates[k] === null ? null : "";
        (nextEn as Record<string, unknown>)[k] = empty;
        (nextDe as Record<string, unknown>)[k] = empty;
      }
    }

    await handleSave(undefined, {
      premergedProfile: nextEn,
      premergedProfileDe: Object.keys(nextDe).length ? nextDe : null,
    });
  };

  const handleDemographicSave = async (updates: Partial<PersonaProfile>) => {
    await handleSave(updates);
  };

  const handleSaveInterests = async (chips: string[]) => {
    await handleDemographicSave({ interests: chips });
  };

  const handleGenerateInterestsIdeas = async () => {
    if (!detail) return;
    setPersonaAiError(null);
    try {
      // Build existing interests summary
      const existingInterests = detail.profile.interests || [];
      const existingInterestsSummary = existingInterests.length > 0
        ? existingInterests.join(", ")
        : t("personaAdmin.aiContext.noInterests");

      // Build target group summary
      const targetGroupSummary = detail.profile.segment || t("personaAdmin.aiContext.noTargetGroup");

      // Build persona profile JSON
      const personaProfile = JSON.stringify(detail.profile, null, 2);

      const result = await runPersonaAiAssist({
        templateId: "persona.interests",
        context: {
          persona_name: detail.profile.name || "",
          persona_segment: detail.profile.segment || "",
          persona_profile: personaProfile,
          persona_interests: existingInterestsSummary,
          target_group_summary: targetGroupSummary,
          max_items: 4,
        },
        maxSuggestions: 4,
      });
      if (!result.suggestions.length) {
        setPersonaAiError(t("personaAdmin.toasts.noAiSuggestions"));
        return;
      }
      const current = detail.profile.interests || [];
      const merged = Array.from(
        new Set([
          ...current,
          ...result.suggestions.map((suggestion) => suggestion.title || suggestion.content),
        ])
      ).filter(Boolean) as string[];
      if (!merged.length) {
        setPersonaAiError(t("personaAdmin.toasts.noValidGenerated"));
        return;
      }
      await handleSaveInterests(merged);
      notify(t("personaAdmin.toasts.aiInterestsAdded"));
    } catch (error) {
      setPersonaAiError(error instanceof Error ? error.message : t("personaAdmin.toasts.aiRequestFailed"));
    }
  };

  const handleSaveValues = async (chips: string[]) => {
    await handleDemographicSave({ values: chips });
  };

  const handleGenerateValuesIdeas = async () => {
    if (!detail) return;
    setPersonaAiError(null);
    try {
      // Build existing values summary
      const existingValues = detail.profile.values || [];
      const existingValuesSummary = existingValues.length > 0
        ? existingValues.join(", ")
        : t("personaAdmin.aiContext.noValues");

      // Build target group summary
      const targetGroupSummary = detail.profile.segment || t("personaAdmin.aiContext.noTargetGroup");

      // Build persona profile JSON
      const personaProfile = JSON.stringify(detail.profile, null, 2);

      const result = await runPersonaAiAssist({
        templateId: "persona.values",
        context: {
          persona_name: detail.profile.name || "",
          persona_segment: detail.profile.segment || "",
          persona_profile: personaProfile,
          persona_values: existingValuesSummary,
          target_group_summary: targetGroupSummary,
          max_items: 4,
        },
        maxSuggestions: 4,
      });
      if (!result.suggestions.length) {
        setPersonaAiError(t("personaAdmin.toasts.noAiSuggestions"));
        return;
      }
      const current = detail.profile.values || [];
      const merged = Array.from(
        new Set([
          ...current,
          ...result.suggestions.map((suggestion) => suggestion.title || suggestion.content),
        ])
      ).filter(Boolean) as string[];
      if (!merged.length) {
        setPersonaAiError(t("personaAdmin.toasts.noValidGenerated"));
        return;
      }
      await handleSaveValues(merged);
      notify(t("personaAdmin.toasts.aiValuesAdded"));
    } catch (error) {
      setPersonaAiError(error instanceof Error ? error.message : t("personaAdmin.toasts.aiRequestFailed"));
    }
  };

  const handleSaveSocialMedia = async (chips: string[]) => {
    await handleDemographicSave({ social_media_usage: chips });
  };

  const traitArrayToRecord = (chips: string[]) => {
    const traitsRecord: Record<string, number> = {};
    chips.forEach((trait) => {
      const key = trait.replace(/\s+/g, "_");
      traitsRecord[key] = 1.0;
    });
    return traitsRecord;
  };

  const applyTraitsLocally = (traitsRecord: Record<string, number>) => {
    setDetail((prev) =>
      prev
        ? {
          ...prev,
          profile: {
            ...prev.profile,
            traits: traitsRecord
          }
        }
        : prev
    );
  };

  const handleSaveTraits = async (chips: string[]) => {
    const traitsRecord = traitArrayToRecord(chips);
    applyTraitsLocally(traitsRecord);
    await handleDemographicSave({ traits: traitsRecord });
  };

  const handleSaveVocabulary = async (chips: string[]) => {
    const currentCommunicationStyle = detail?.profile?.communication_style || {
      vocabulary: [],
      sentence_structure: "",
      skepticism_level: 0
    };
    const previousVocabulary = currentCommunicationStyle.vocabulary || [];
    const newEntries = chips.filter((chip) => {
      const normalized = chip.trim().toLowerCase();
      return !previousVocabulary.some((prev) => prev.trim().toLowerCase() === normalized);
    });
    if (newEntries.length > 0) {
      setRecentVocabularyHighlights(newEntries);
    }
    const updatedCommunicationStyle = {
      ...currentCommunicationStyle,
      vocabulary: chips
    };
    setDetail((prev) =>
      prev
        ? {
          ...prev,
          profile: {
            ...prev.profile,
            communication_style: updatedCommunicationStyle
          }
        }
        : prev
    );
    await handleDemographicSave({
      communication_style: updatedCommunicationStyle
    });
  };

  const handleAiSuggestTraits = async () => {
    if (!detail) {
      notify(t("personaAdmin.toasts.noPersonaSelected"));
      return;
    }

    try {
      setPersonaAiError(null);

      // Build existing traits summary
      const existingTraits = Object.keys(detail.profile.traits || {}).map(trait =>
        trait.replace(/_/g, " ")
      );
      const existingTraitsSummary = existingTraits.length > 0
        ? existingTraits.join(", ")
        : t("personaAdmin.aiContext.noTraits");

      // Build graph relationships summary
      const graphRelationshipsSummary = detail.insights && detail.insights.graphRelationships && detail.insights.graphRelationships.length > 0
        ? detail.insights.graphRelationships
          .map(rel => `${rel.relationship}: [${rel.nodes.join(", ")}]`)
          .join("\n")
        : t("personaAdmin.aiContext.noGraphRelationships");

      // Build knowledge context summary (using chunk IDs for now)
      const knowledgeContext = detail.insights && detail.insights.relatedChunkIds && detail.insights.relatedChunkIds.length > 0
        ? t("personaAdmin.aiContext.researchChunksAvailable", { count: detail.insights.relatedChunkIds.length })
        : t("personaAdmin.aiContext.noResearchChunks");

      // Build target group summary (placeholder - would need to fetch target group)
      const targetGroupSummary = detail.profile.segment || t("personaAdmin.aiContext.noTargetGroup");

      const result = await runPersonaAiAssist({
        templateId: "persona.traits",
        context: {
          persona_name: detail.profile.name || "",
          persona_headline: detail.profile.headline || "",
          persona_bio: detail.profile.bio || "",
          existing_traits: existingTraitsSummary,
          graph_relationships_summary: graphRelationshipsSummary,
          knowledge_context: knowledgeContext,
          target_group_summary: targetGroupSummary,
          max_items: 5,
        },
        maxSuggestions: 5,
      });

      // Parse suggestions and add to existing traits
      if (result.suggestions && result.suggestions.length > 0) {
        const currentTraits = Object.keys(detail.profile.traits || {}).map(trait =>
          trait.replace(/_/g, " ")
        );

        // Extract trait names from suggestions
        const newTraits = result.suggestions
          .map(s => s.content || s.title || "")
          .filter(t => t && !currentTraits.some(ct => ct.toLowerCase() === t.toLowerCase()));

        if (newTraits.length > 0) {
          // Merge with existing traits
          const allTraits = [...currentTraits, ...newTraits];
          setRecentTraitHighlights(newTraits);
          await handleSaveTraits(allTraits);
          notify(t("personaAdmin.toasts.aiTraitsAdded", { count: newTraits.length }));
        } else {
          notify(t("personaAdmin.toasts.noNewTraits"));
        }
      } else {
        notify(t("personaAdmin.toasts.aiNoTraits"));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t("personaAdmin.toasts.aiRequestFailed");
      setPersonaAiError(errorMessage);
      notify(errorMessage);
    }
  };

  const handleAiSuggestVocabulary = async () => {
    if (!detail) {
      notify(t("personaAdmin.toasts.noPersonaSelected"));
      return;
    }

    try {
      setPersonaAiError(null);

      // Build existing vocabulary summary
      const existingVocabulary = detail.profile.communication_style?.vocabulary || [];
      const existingVocabularySummary = existingVocabulary.length > 0
        ? existingVocabulary.join(", ")
        : t("personaAdmin.aiContext.noVocabulary");

      // Build graph relationships summary
      const graphRelationshipsSummary = detail.insights && detail.insights.graphRelationships && detail.insights.graphRelationships.length > 0
        ? detail.insights.graphRelationships
          .map(rel => `${rel.relationship}: [${rel.nodes.join(", ")}]`)
          .join("\n")
        : t("personaAdmin.aiContext.noGraphRelationships");

      // Build knowledge context summary (using chunk IDs for now)
      const knowledgeContext = detail.insights && detail.insights.relatedChunkIds && detail.insights.relatedChunkIds.length > 0
        ? t("personaAdmin.aiContext.researchChunksAvailable", { count: detail.insights.relatedChunkIds.length })
        : t("personaAdmin.aiContext.noResearchChunks");

      // Build target group summary (placeholder - would need to fetch target group)
      const targetGroupSummary = detail.profile.segment || t("personaAdmin.aiContext.noTargetGroup");

      const result = await runPersonaAiAssist({
        templateId: "persona.vocabulary",
        context: {
          persona_name: detail.profile.name || "",
          persona_headline: detail.profile.headline || "",
          persona_bio: detail.profile.bio || "",
          existing_vocabulary: existingVocabularySummary,
          graph_relationships_summary: graphRelationshipsSummary,
          knowledge_context: knowledgeContext,
          target_group_summary: targetGroupSummary,
          max_items: 5,
        },
        maxSuggestions: 5,
      });

      // Parse suggestions and add to existing vocabulary
      if (result.suggestions && result.suggestions.length > 0) {
        const currentVocabulary = detail.profile.communication_style?.vocabulary || [];

        // Extract vocabulary words from suggestions
        const newVocabulary = result.suggestions
          .map(s => s.content || s.title || "")
          .filter(v => v && !currentVocabulary.some(cv => cv.toLowerCase() === v.toLowerCase()));

        if (newVocabulary.length > 0) {
          // Merge with existing vocabulary
          const allVocabulary = [...currentVocabulary, ...newVocabulary];
          setRecentVocabularyHighlights(newVocabulary);
          await handleSaveVocabulary(allVocabulary);
          notify(t("personaAdmin.toasts.aiVocabularyAdded", { count: newVocabulary.length }));
        } else {
          notify(t("personaAdmin.toasts.noNewVocabulary"));
        }
      } else {
        notify(t("personaAdmin.toasts.aiNoVocabulary"));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t("personaAdmin.toasts.aiRequestFailed");
      setPersonaAiError(errorMessage);
      notify(errorMessage);
    }
  };

  const getCommunicationStyleSnapshot = () =>
    detail?.profile?.communication_style || {
      vocabulary: [],
      sentence_structure: "",
      skepticism_level: 0,
    };

  const handleSaveSentenceStructure = async (value: string) => {
    const currentCommunicationStyle = getCommunicationStyleSnapshot();
    await handleDemographicSave({
      communication_style: {
        ...currentCommunicationStyle,
        sentence_structure: value,
      },
    });
  };

  const handleSaveSkepticismLevel = async (value: number) => {
    const currentCommunicationStyle = getCommunicationStyleSnapshot();
    await handleDemographicSave({
      communication_style: {
        ...currentCommunicationStyle,
        skepticism_level: value,
      },
    });
  };

  const handleSavePainPoints = async (chips: string[]) => {
    // Convert string[] back to Array<{ label: string; evidence_count: number }>
    // Use default evidence_count of 0
    const painPointsArray = chips.map(label => ({
      label,
      evidence_count: 0,
    }));
    await handleDemographicSave({ pain_points: painPointsArray });
  };

  const handleGeneratePainPointIdeas = async () => {
    if (!detail) return;
    setPersonaAiError(null);
    try {
      const result = await runPersonaAiAssist({
        templateId: "persona.pain_points",
        context: {
          persona_id: selectedId || "",
        },
        maxSuggestions: 4,
      });
      if (!result.suggestions.length) {
        setPersonaAiError(t("personaAdmin.toasts.noAiSuggestions"));
        return;
      }
      const current = detail.profile.pain_points?.map((pp) => pp.label) ?? [];
      const merged = Array.from(
        new Set([
          ...current,
          ...result.suggestions.map((suggestion) => suggestion.title || suggestion.content),
        ])
      ).filter(Boolean) as string[];
      if (!merged.length) {
        setPersonaAiError(t("personaAdmin.toasts.noValidGenerated"));
        return;
      }
      await handleSavePainPoints(merged);
      notify(t("personaAdmin.toasts.aiPainPointsAdded"));
    } catch (error) {
      setPersonaAiError(error instanceof Error ? error.message : t("personaAdmin.toasts.aiRequestFailed"));
    }
  };

  const handleSaveGoals = async (chips: string[]) => {
    // Convert string[] back to Array<{ label: string; priority: number }>
    // Use default priority of 999 (low priority)
    const goalsArray = chips.map(label => ({
      label,
      priority: 999,
    }));
    await handleDemographicSave({ goals: goalsArray });
  };

  const handleGenerateGoalsIdeas = async () => {
    if (!detail) return;
    setPersonaAiError(null);
    try {
      // Build existing goals summary
      const existingGoals = detail.profile.goals?.map((goal) => goal.label) ?? [];
      const existingGoalsSummary = existingGoals.length > 0
        ? existingGoals.join(", ")
        : t("personaAdmin.aiContext.noGoals");

      // Build target group summary
      const targetGroupSummary = detail.profile.segment || t("personaAdmin.aiContext.noTargetGroup");

      // Build persona profile JSON
      const personaProfile = JSON.stringify(detail.profile, null, 2);

      const result = await runPersonaAiAssist({
        templateId: "persona.goals",
        context: {
          persona_name: detail.profile.name || "",
          persona_segment: detail.profile.segment || "",
          persona_profile: personaProfile,
          persona_goals: existingGoalsSummary,
          target_group_summary: targetGroupSummary,
          max_items: 4,
        },
        maxSuggestions: 4,
      });
      if (!result.suggestions.length) {
        setPersonaAiError(t("personaAdmin.toasts.noAiSuggestions"));
        return;
      }
      const current = detail.profile.goals?.map((goal) => goal.label) ?? [];
      const merged = Array.from(
        new Set([
          ...current,
          ...result.suggestions.map((suggestion) => suggestion.title || suggestion.content),
        ])
      ).filter(Boolean) as string[];
      if (!merged.length) {
        setPersonaAiError(t("personaAdmin.toasts.noValidGenerated"));
        return;
      }
      await handleSaveGoals(merged);
      notify(t("personaAdmin.toasts.aiGoalsAdded"));
    } catch (error) {
      setPersonaAiError(error instanceof Error ? error.message : t("personaAdmin.toasts.aiRequestFailed"));
    }
  };

  const handleCreate = async () => {
    if (!activeProjectId || !createForm.name) {
      notify(t("personaAdmin.toasts.projectNameRequired"));
      return;
    }
    setCreatePending(true);
    try {
      const hlPair = mirrorFillStringPair(createForm.headline || "New Persona", "");
      const headlineEn = hlPair.en.trim() || "New Persona";
      const headlineDeTrim = hlPair.de.trim() || null;
      const payload = {
        project_id: activeProjectId,
        name: createForm.name,
        segment: createForm.segment || "unspecified",
        headline: headlineEn,
        ...(headlineDeTrim ? { headline_de: headlineDeTrim } : {}),
        profile: {
          id: "",
          name: createForm.name,
          segment: createForm.segment || "unspecified",
          headline: headlineEn,
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
      const response = await fetch(buildApiUrl("/api/persona-admin"), {
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
      notify(t("personaAdmin.toasts.personaCreated"));
    } catch (error) {
      console.error("Persona creation failed", error);
      notify(t("personaAdmin.toasts.creationFailed"));
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
      const response = await fetch(buildApiUrl(`/api/persona-admin/${selectedId}?actor=persona-admin-ui`), {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      await refreshList();
      notify(t("personaAdmin.toasts.personaArchived"));
    } catch (error) {
      console.error("Persona archive failed", error);
      notify(t("personaAdmin.toasts.archivingFailed"));
    } finally {
      setSavePending(false);
    }
  };

  const handleDelete = () => {
    if (!selectedId || !detail) return;
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedId || !detail) {
      setDeleteDialogOpen(false);
      return;
    }

    setSavePending(true);
    try {
      const response = await fetch(buildApiUrl(`/api/persona-admin/${selectedId}?actor=persona-admin-ui`), {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      await refreshList();
      setSelectedId(null);
      setDetail(null);
      setDeleteDialogOpen(false);
      notify(t("personaAdmin.toasts.personaDeleted"));
    } catch (error) {
      console.error("Persona delete failed", error);
      notify(t("personaAdmin.toasts.deleteFailed"));
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
      const target = buildApiUrl(`/api/persona-admin/${selectedId}/documents`);
      const response = await fetch(target, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }
      await loadDetail(selectedId);
      notify(t("personaAdmin.toasts.documentUploaded"));
    } catch (error) {
      console.error("Document upload failed", error);
      notify(t("personaAdmin.toasts.documentUploadFailed"));
    } finally {
      setDocumentUploadPending(false);
    }
  };

  const triggerDocumentUpload = () => {
    documentInputRef.current?.click();
  };

  const handleEnrichWithAi = async () => {
    if (!selectedId || !detail) return;
    setEnrichPending(true);
    try {
      const profile = detail.profile as Record<string, unknown> | undefined;
      const profileOverlay = {
        bio: profile?.bio ?? "",
        age: profile?.age ?? null,
        location: profile?.location ?? null,
        gender: profile?.gender ?? null,
      };
      const response = await fetch(buildApiUrl(`/api/personas/${selectedId}/enrich`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_overlay: profileOverlay }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(typeof err.detail === "string" ? err.detail : "Enrich failed");
      }
      await loadDetail(selectedId);
      notify(t("personaAdmin.toasts.personaEnriched"));
    } catch (error) {
      console.error("Enrich with AI failed", error);
      notify((error instanceof Error ? error.message : t("personaAdmin.toasts.enrichFailed")) ?? "Enrich failed");
    } finally {
      setEnrichPending(false);
    }
  };

  const handleEnsureChatPrompt = async () => {
    if (!selectedId) return;
    setEnsureChatPromptPending(true);
    try {
      const response = await fetch(buildApiUrl(`/api/personas/${selectedId}/ensure-chat-prompt`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(typeof err.detail === "string" ? err.detail : "Ensure chat prompt failed");
      }
      const data = (await response.json()) as { ensured?: boolean; prompt_length?: number };
      if (data.ensured) {
        notify(t("personaAdmin.toasts.chatPromptUpdated"));
      } else {
        notify(t("personaAdmin.toasts.chatPromptAlreadyCurrent"));
      }
      await loadDetail(selectedId);
    } catch (error) {
      console.error("Ensure chat prompt failed", error);
      notify((error instanceof Error ? error.message : t("personaAdmin.toasts.chatPromptFailed")) ?? "Failed");
    } finally {
      setEnsureChatPromptPending(false);
    }
  };

  const handleGenerateAvatar = async () => {
    if (!selectedId) {
      return;
    }
    setAvatarGeneratePending(true);
    try {
      const response = await fetch(buildApiUrl(`/api/persona-admin/${selectedId}/generate-image`), {
        method: "POST",
      });
      const contentType = response.headers.get("content-type") || "";
      let payload: { status?: string; detail?: string; message?: string; persist_warning?: string } | null = null;
      if (contentType.includes("application/json")) {
        payload = await response.json().catch(() => null);
      } else {
        const text = await response.text().catch(() => "");
        if (text) {
          payload = { detail: text };
        }
      }
      if (!response.ok) {
        const errorMessage = payload?.detail || payload?.message || "Avatar generation failed";
        throw new Error(errorMessage);
      }
      if (payload?.status !== "success") {
        notify(t("personaAdmin.toasts.avatarFailed"));
        return;
      }
      await loadDetail(selectedId);
      notify(t("personaAdmin.toasts.avatarGenerated"));
      if (payload?.persist_warning) {
        notify(payload.persist_warning);
      }
    } catch (error) {
      console.error("Avatar generation failed", error);
      notify((error as Error)?.message || t("personaAdmin.toasts.avatarGenerateFailed"));
    } finally {
      setAvatarGeneratePending(false);
    }
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
      notify(t("personaAdmin.toasts.titleContentRequired"));
      return;
    }
    setKnowledgePending(true);
    try {
      const payload = {
        title: knowledgeForm.title,
        content: knowledgeForm.content,
        created_by: "persona-admin-ui",
      };
      const target = buildApiUrl(`/api/persona-admin/${selectedId}/knowledge`);
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
      notify(t("personaAdmin.toasts.knowledgeAdded"));
    } catch (error) {
      console.error("Knowledge add failed", error);
      notify(t("personaAdmin.toasts.knowledgeSaveFailed"));
    } finally {
      setKnowledgePending(false);
    }
  };

  return (
    <div
      className="msqdx-glass-admin-grid"
      style={mode === "detail" ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}
    >
      {mode === "full" && (
        <MsqdxGlassCollapsiblePanel title={t("personaAdmin.title")} defaultExpanded={true}>
          <section className="msqdx-glass-panel">
          <header className="msqdx-glass-panel__header">
            <div>
              <MsqdxTypography variant="h5" weight="semibold">{t("personaAdmin.title")}</MsqdxTypography>
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>{t("personaAdmin.entries", { count: list.total })}</MsqdxTypography>
            </div>
            <MsqdxButton variant="text" size="small" onClick={refreshList} disabled={listRefreshing} startIcon={<MsqdxIcon name="refresh" customSize={16} />}>
              {t("personaAdmin.refresh")}
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
                {t("personaAdmin.empty")}
              </MsqdxTypography>
            )}
            {list.items.map((item) => {
              return (
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
                    <MsqdxTypography variant="subtitle1" weight="semibold">
                      {item.name}
                    </MsqdxTypography>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                      {item.segment} · {t("personaAdmin.versionLabel", { version: item.version })}
                    </MsqdxTypography>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                      {t("personaAdmin.lastUpdated")} {formatDate(item.updatedAt)}
                    </MsqdxTypography>
                  </Box>
                </MsqdxCard>
              );
            })}
          </Box>
          <MsqdxCard variant="flat" borderRadius="button" sx={{ mt: 2, p: 2, border: "1px solid", borderColor: "divider" }}>
            <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
              {t("personaAdmin.newPersona")}
            </MsqdxTypography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                {activeProject?.name
                  ? t("personaAdmin.projectLabel", { name: activeProject.name })
                  : activeProjectId
                    ? t("personaAdmin.projectIdLabel", { id: activeProjectId })
                    : t("personaAdmin.selectProject")}
              </MsqdxTypography>
              <MsqdxFormField
                label={t("personaAdmin.name")}
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t("personaAdmin.namePlaceholder")}
                fullWidth
                size="small"
              />
              <MsqdxFormField
                label={t("personaAdmin.segment")}
                value={createForm.segment}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, segment: e.target.value }))}
                placeholder={t("personaAdmin.segmentPlaceholder")}
                fullWidth
                size="small"
              />
              <MsqdxFormField
                label={t("personaAdmin.headline")}
                value={createForm.headline}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, headline: e.target.value }))}
                placeholder={t("personaAdmin.headlinePlaceholder")}
                fullWidth
                size="small"
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
                {t("personaAdmin.create")}
              </MsqdxButton>
            </Box>
          </MsqdxCard>
          </section>
        </MsqdxGlassCollapsiblePanel>
      )}

      <section
        className="msqdx-glass-panel"
        style={mode === "detail" ? { gridColumn: "1 / -1" } : undefined}
      >
        {!selectedId && <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>{t("personaAdmin.selectPersona")}</MsqdxTypography>}
        {selectedId && detailLoading && <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>{t("personaAdmin.loading")}</MsqdxTypography>}
        {detailError && <MsqdxTypography variant="body2" sx={{ color: "error.main" }}>{detailError}</MsqdxTypography>}
        {detail && (
          <div className="msqdx-glass-detail">
            <input ref={documentInputRef} type="file" className="msqdx-glass-sr-only" onChange={handleDocumentInputChange} />

            {/* Dashboard Cards Grid */}
            <div className="msqdx-glass-dashboard-grid">

              {/* Persona header (name, headline, segment); bio & demographics in the next card */}
              <Box sx={{ gridColumn: "1 / -1" }}>
                <MsqdxDashboardCard
                  id="persona-basics"
                  title={t("personaAdmin.personaBasics")}
                  icon="person"
                  iconColor={{ color: THEME_ACCENT.color }}
                  expanded={isAccordionExpanded("persona-basics")}
                  onToggle={toggleAccordion}
                >
                  <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", mb: 2 }}>
                    <div className="msqdx-glass-avatar" style={{ flexShrink: 0 }}>
                      {detail.metadata.avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={safeAvatarSrc(detail.metadata.avatarUrl, detail.metadata.personaId) ?? detail.metadata.avatarUrl} alt={`${detail.profile.name} Avatar`} />
                      ) : (
                        <MsqdxIcon name="person" customSize={32} />
                      )}
                    </div>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {(() => {
                        const fieldDefinitions = getFieldDefinitions("persona");
                        const nameField = fieldDefinitions.find(f => f.key === "name");
                        const segmentField = fieldDefinitions.find(f => f.key === "segment");
                        const handleFieldSave = async (key: string, value: any) => {
                          await handleSave({ [key]: value } as Partial<EditFormState>);
                          setEditingField(null);
                        };
                        const handleFieldChange = () => { };
                        return (
                          <div>
                            {nameField && (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                {editingField === "name" ? (
                                  <Box sx={{ flex: 1 }}>
                                    <MsqdxGlassFieldEditor
                                      field={nameField}
                                      value={detail.profile.name}
                                      valueSyncKey={selectedId || undefined}
                                      onChange={handleFieldChange}
                                      onSave={(k, v) => handleFieldSave(k, v)}
                                      inline={true}
                                      disabled={savePending}
                                      forceEditMode={true}
                                      onEditEnd={() => setEditingField(null)}
                                    />
                                  </Box>
                                ) : (
                                  <>
                                    <h2 style={{ margin: 0, fontSize: "2rem", fontWeight: 600, flex: 1 }}>
                                      {detail.profile.name}
                                    </h2>
                                    <MsqdxGlassEditButton onClick={() => setEditingField("name")} disabled={savePending} aria-label="Edit name" size="small" fontSize={16} />
                                  </>
                                )}
                              </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {editingField === "headline" ? (
                                  <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, width: "100%" }}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      label={t("personaAdmin.headline")}
                                      value={locale === "de" ? editForm.headline_de : editForm.headline}
                                      onChange={(e) => {
                                        metadataFormDirtyRef.current = true;
                                        if (locale === "de") {
                                          setEditForm((prev) => ({ ...prev, headline_de: e.target.value }));
                                        } else {
                                          setEditForm((prev) => ({ ...prev, headline: e.target.value }));
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
                                          setEditForm((prev) => ({
                                            ...prev,
                                            headline: detail.profile.headline,
                                            headline_de: detail.headline_de ?? "",
                                          }));
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
                                              locale === "de"
                                                ? editForm.headline_de.trim()
                                                : editForm.headline.trim();
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
                                                    translated ||
                                                    mirrorFillStringPair("", raw).en ||
                                                    headlineEn;
                                                } else {
                                                  headlineEn = raw;
                                                  headlineDe =
                                                    translated ||
                                                    mirrorFillStringPair(raw, "").de ||
                                                    headlineDe;
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
                                            await handleSave({ headline: headlineEn, headline_de: headlineDe });
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
                                    <span style={{ fontSize: "1rem", color: "var(--color-text-secondary)" }}>
                                      {locale === "de"
                                        ? detail.headline_de?.trim() || detail.profile.headline || "—"
                                        : detail.profile.headline || "—"}
                                    </span>
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

                              {segmentField && (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  {editingField === "segment" ? (
                                    <Box sx={{ flex: 1 }}>
                                      <MsqdxGlassFieldEditor
                                        field={segmentField}
                                        value={detail.profile.segment}
                                        valueSyncKey={selectedId || undefined}
                                        onChange={handleFieldChange}
                                        onSave={(k, v) => handleFieldSave(k, v)}
                                        inline={true}
                                        disabled={savePending}
                                        forceEditMode={true}
                                        onEditEnd={() => setEditingField(null)}
                                      />
                                    </Box>
                                  ) : (
                                    <>
                                      <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>{detail.profile.segment || "—"}</span>
                                      <MsqdxGlassEditButton onClick={() => setEditingField("segment")} disabled={savePending} aria-label="Edit segment" size="small" fontSize={14} />
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
                                <MsqdxButton variant="outlined" size="small" onClick={handleEnrichWithAi} disabled={enrichPending || savePending} startIcon={<MsqdxIcon name="auto_awesome" customSize={16} />}>
                                  {enrichPending ? t("personaAdmin.enrichingWithAi") : t("personaAdmin.enrichWithAi")}
                                </MsqdxButton>
                                <Tooltip title={t("personaAdmin.ensureChatPromptTooltip")}>
                                  <span>
                                    <MsqdxButton variant="text" size="small" onClick={handleEnsureChatPrompt} disabled={ensureChatPromptPending || savePending} startIcon={<MsqdxIcon name="chat" customSize={16} />}>
                                      {ensureChatPromptPending ? t("personaAdmin.ensuringChatPrompt") : t("personaAdmin.ensureChatPrompt")}
                                    </MsqdxButton>
                                  </span>
                                </Tooltip>
                                <MsqdxButton variant="text" size="small" onClick={handleGenerateAvatar} disabled={avatarGeneratePending} startIcon={<MsqdxIcon name="photo_camera" customSize={16} />}>
                                  {avatarGeneratePending ? t("personaAdmin.generatingAvatar") : t("personaAdmin.generateAvatar")}
                                </MsqdxButton>
                              </Box>
                              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", flexWrap: "wrap", pt: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
                                <MsqdxButton variant="text" size="small" onClick={handleArchive} disabled={savePending} startIcon={<MsqdxIcon name="archive" customSize={16} />}>
                                  {t("personaAdmin.archive")}
                                </MsqdxButton>
                                <MsqdxButton variant="text" size="small" onClick={handleDelete} disabled={savePending} brandColor="pink" startIcon={<MsqdxIcon name="delete" customSize={16} />}>
                                  {t("personaAdmin.delete")}
                                </MsqdxButton>
                              </Box>
                            </Box>
                          </div>
                        );
                      })()}
                    </Box>
                  </Box>
                </MsqdxDashboardCard>
              </Box>

              {profileForBioEditor ? (
                <MsqdxGlassBioCardEdit
                  profile={profileForBioEditor}
                  expanded={isAccordionExpanded("bio-demographics")}
                  onToggle={toggleAccordion}
                  onSave={handleBioDemographicsBilingualSave}
                  savePending={savePending}
                />
              ) : null}

              {/* Card: Metadata - full width */}
              <Box sx={{ gridColumn: "1 / -1" }}>
                <MsqdxDashboardCard
                  id="metadata"
                  title={t("personaAdmin.metadata")}
                  icon="info"
                  iconColor={{ color: THEME_ACCENT.color }}
                  expanded={isAccordionExpanded("metadata")}
                  onToggle={toggleAccordion}
                >
                  <Box sx={{ pt: 1 }}>
                    {!(detail.metadata.targetGroupId ?? (detail.profile as { targetGroupId?: string }).targetGroupId) && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {t("personaAdmin.noTargetGroupDetailHint")}
                      </Alert>
                    )}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
                      <Box sx={{ minWidth: 200 }}>
                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.5 }}>
                          {t("personaAdmin.project")}
                        </MsqdxTypography>
                        <Box
                          component="select"
                          value={detail.metadata.projectId ?? ""}
                          onChange={(e) => handleSaveMetadataAssignment({ project_id: e.target.value, target_group_id: "" })}
                          disabled={metadataAssignPending || savePending}
                          sx={{
                            width: "100%",
                            py: 0.75,
                            px: 1,
                            fontSize: "0.875rem",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                            bgcolor: "background.paper",
                            color: "text.primary",
                          }}
                        >
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Box>
                      </Box>
                      <Box sx={{ minWidth: 200 }}>
                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.5 }}>
                          {t("personaAdmin.targetGroup")}
                        </MsqdxTypography>
                        <Box
                          component="select"
                          value={detail.metadata.targetGroupId ?? (detail.profile as { targetGroupId?: string }).targetGroupId ?? ""}
                          onChange={(e) => handleSaveMetadataAssignment({ target_group_id: e.target.value === "" ? "" : e.target.value })}
                          disabled={metadataAssignPending || savePending}
                          sx={{
                            width: "100%",
                            py: 0.75,
                            px: 1,
                            fontSize: "0.875rem",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                            bgcolor: "background.paper",
                            color: "text.primary",
                          }}
                        >
                          <option value="">{t("personaAdmin.noTargetGroup")}</option>
                          {targetGroupsForMetadata.map((tg) => (
                            <option key={tg.id} value={tg.id}>
                              {tg.name}
                            </option>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      gap: 1.5,
                      pt: 1,
                    }}
                  >
                    <Box sx={{ minWidth: 140 }}>
                      <Tooltip title={t("personaAdmin.confidenceHint")}>
                        <Box>
                          <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                            {t("personaAdmin.confidence")}
                          </MsqdxTypography>
                          <MsqdxTypography variant="body2" weight="medium" sx={{ mb: 0.5 }}>
                            {t("personaAdmin.confidencePercent", {
                              value: Math.round(Math.min(1, Math.max(0, detail.metadata.confidence)) * 100),
                            })}
                          </MsqdxTypography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, Math.max(0, detail.metadata.confidence * 100))}
                            sx={{ height: 6, borderRadius: 1 }}
                          />
                        </Box>
                      </Tooltip>
                    </Box>
                    <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                        {t("personaAdmin.version")}
                      </MsqdxTypography>
                      <MsqdxTypography variant="body2" weight="medium">{detail.metadata.version}</MsqdxTypography>
                    </Box>
                    <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                        {t("personaAdmin.updated")}
                      </MsqdxTypography>
                      <MsqdxTypography variant="body2" weight="medium">{formatDate(detail.metadata.updatedAt)}</MsqdxTypography>
                    </Box>
                    <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                        {t("personaAdmin.updatedBy")}
                      </MsqdxTypography>
                      <MsqdxTypography variant="body2" weight="medium">{detail.metadata.updatedBy ?? "—"}</MsqdxTypography>
                    </Box>
                    <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                        {t("personaAdmin.lastReview")}
                      </MsqdxTypography>
                      <MsqdxTypography variant="body2" weight="medium">{formatDate(detail.metadata.lastReviewedAt)}</MsqdxTypography>
                    </Box>
                    {detail.profile.created_at && (
                      <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                          {t("personaAdmin.createdAt")}
                        </MsqdxTypography>
                        <MsqdxTypography variant="body2" weight="medium">{formatDate(detail.profile.created_at)}</MsqdxTypography>
                      </Box>
                    )}
                    {(detail.metadata.targetGroupId ?? (detail.profile as { targetGroupId?: string }).targetGroupId) && (
                      <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                          {t("personaAdmin.targetGroup")}
                        </MsqdxTypography>
                        <MsqdxButton
                          variant="text"
                          size="small"
                          component="a"
                          href={`/admin/target-groups?selected=${detail.metadata.targetGroupId ?? (detail.profile as { targetGroupId?: string }).targetGroupId}`}
                          sx={{ fontSize: "0.875rem", p: "4px 8px" }}
                          startIcon={<MsqdxIcon name="groups" customSize={14} />}
                        >
                          {t("personaAdmin.toTargetGroup")}
                        </MsqdxButton>
                      </Box>
                    )}
                  </Box>
                </MsqdxDashboardCard>
              </Box>

              <Box sx={{ gridColumn: "1 / -1" }}>
                <MsqdxDashboardCard
                  id="integrations"
                  title={t("personaAdmin.integrations")}
                  icon="link"
                  iconColor={{ color: THEME_ACCENT.color }}
                  expanded={isAccordionExpanded("integrations")}
                  onToggle={toggleAccordion}
                >
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, pt: 1 }}>
                    <Box sx={{ minWidth: 200, flex: "1 1 200px" }}>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.5 }}>
                        {t("personaAdmin.tavusReplicaId")}
                      </MsqdxTypography>
                      <Box
                        component="input"
                        type="text"
                        key={`${selectedId}-tavus-replica`}
                        defaultValue={detail.metadata.tavusReplicaId ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== (detail.metadata.tavusReplicaId ?? null)) {
                            handleSaveMetadataAssignment({ tavus_replica_id: v });
                          }
                        }}
                        disabled={metadataAssignPending || savePending}
                        placeholder={t("personaAdmin.tavusReplicaIdPlaceholder")}
                        sx={{
                          width: "100%",
                          py: 0.75,
                          px: 1,
                          fontSize: "0.875rem",
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                          bgcolor: "background.paper",
                          color: "text.primary",
                        }}
                      />
                    </Box>
                    <Box sx={{ minWidth: 200, flex: "1 1 200px" }}>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.5 }}>
                        {t("personaAdmin.tavusPersonaId")}
                      </MsqdxTypography>
                      <Box
                        component="input"
                        type="text"
                        key={`${selectedId}-tavus-persona`}
                        defaultValue={detail.metadata.tavusPersonaId ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== (detail.metadata.tavusPersonaId ?? null)) {
                            handleSaveMetadataAssignment({ tavus_persona_id: v });
                          }
                        }}
                        disabled={metadataAssignPending || savePending}
                        placeholder={t("personaAdmin.tavusPersonaIdPlaceholder")}
                        sx={{
                          width: "100%",
                          py: 0.75,
                          px: 1,
                          fontSize: "0.875rem",
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                          bgcolor: "background.paper",
                          color: "text.primary",
                        }}
                      />
                    </Box>
                  </Box>
                </MsqdxDashboardCard>
              </Box>

              {/* Cards: Personality (Traits), Interests, Values – three columns */}
              <MsqdxGlassPersonalityCard
                profile={detail.profile}
                expandedTraits={isAccordionExpanded("personality-traits")}
                expandedInterests={isAccordionExpanded("personality-interests")}
                expandedValues={isAccordionExpanded("personality-values")}
                onToggle={toggleAccordion}
                onSaveInterests={handleSaveInterests}
                onSaveValues={handleSaveValues}
                onSaveSocialMedia={handleSaveSocialMedia}
                onSaveTraits={handleSaveTraits}
                onAiSuggestTraits={handleAiSuggestTraits}
                aiTraitsLoading={personaAiLoading}
                onAiSuggestInterests={handleGenerateInterestsIdeas}
                aiInterestsLoading={personaAiLoading}
                onAiSuggestValues={handleGenerateValuesIdeas}
                aiValuesLoading={personaAiLoading}
                highlightedTraits={recentTraitHighlights}
              />

              {/* Card: Kommunikation - 50% width (nebeneinander mit Personality) */}
              {detail.profile.communication_style && (
                <MsqdxGlassCommunicationCard
                  profile={detail.profile}
                  expanded={isAccordionExpanded("communication")}
                  onToggle={toggleAccordion}
                  onSaveVocabulary={handleSaveVocabulary}
                  onSaveSentenceStructure={handleSaveSentenceStructure}
                  onSaveSkepticismLevel={handleSaveSkepticismLevel}
                  onAiSuggestVocabulary={handleAiSuggestVocabulary}
                  aiVocabularyLoading={personaAiLoading}
                  highlightedVocabulary={recentVocabularyHighlights}
                />
              )}

              {/* Card: Pain Points & Goals - Full Width, zweispaltig */}
              <MsqdxGlassPainPointsGoalsCard
                profile={detail.profile}
                expanded={isAccordionExpanded("pain-points-goals")}
                onToggle={toggleAccordion}
                onSavePainPoints={handleSavePainPoints}
                onSaveGoals={handleSaveGoals}
                onAiSuggestGoals={handleGenerateGoalsIdeas}
                aiGoalsLoading={personaAiLoading}
                onAiSuggestPainPoints={handleGeneratePainPointIdeas}
                aiPainPointsLoading={personaAiLoading}
                painPointsToolbar={
                  personaAiError ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                      <span className="msqdx-glass-pain-toolbar__error">{personaAiError}</span>
                    </div>
                  ) : undefined
                }
              />

              {/* Card: Knowledge & Sources - Full Width */}
              <MsqdxGlassKnowledgeSourcesCard
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
              />

              {/* Card: Moodboard - Full Width */}
              <Box sx={{ gridColumn: "1 / -1" }}>
                <MsqdxDashboardCard
                  id="moodboard"
                  title="Moodboard"
                  icon="image"
                  iconColor={{ color: THEME_ACCENT.color }}
                  expanded={isAccordionExpanded("moodboard")}
                  onToggle={toggleAccordion}
                >
                  <Box sx={{ pt: 1 }}>
                    {moodboardError && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {moodboardError}
                      </Alert>
                    )}
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Status
                        </MsqdxTypography>
                        <MsqdxTypography variant="body2" weight="medium">
                          {moodboardLoading ? "Loading…" : moodboard?.status ?? "—"}
                        </MsqdxTypography>
                        {moodboard?.styleKeywords?.length ? (
                          <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                            {moodboard.styleKeywords.slice(0, 6).join(" · ")}
                          </MsqdxTypography>
                        ) : null}
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        {!moodboard ? (
                          <MsqdxButton
                            variant="contained"
                            size="small"
                            brandColor="green"
                            onClick={() => void handleGenerateMoodboard()}
                            disabled={moodboardPending || !selectedId}
                            startIcon={<MsqdxIcon name="auto_awesome" customSize={16} />}
                          >
                            {moodboardPending ? "Generating…" : "Generate"}
                          </MsqdxButton>
                        ) : (
                          <MsqdxButton
                            variant="outlined"
                            size="small"
                            onClick={() => void handleRebuildMoodboard()}
                            disabled={moodboardPending}
                            startIcon={<MsqdxIcon name="refresh" customSize={16} />}
                          >
                            {moodboardPending ? "Rebuilding…" : "Regenerate"}
                          </MsqdxButton>
                        )}
                      </Box>
                    </Box>

                    {moodboard?.tiles?.length ? (
                      <Box sx={moodboardGridContainerSx()}>
                        {(() => {
                          const sortedTiles = sortMoodboardTiles(moodboard.tiles);
                          const tileCount = sortedTiles.length;
                          return sortedTiles.map((tile, index) => (
                            <Box
                              key={tile.id}
                              sx={{
                                ...moodboardTileGridSx(index, tileCount),
                                display: "flex",
                                flexDirection: "column",
                                minHeight: 0,
                                height: "100%",
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: `${moodboardTileCardRadius(index)}px`,
                                overflow: "hidden",
                                backgroundColor: "background.paper",
                                boxShadow: "0 14px 36px rgba(0,0,0,0.08)",
                              }}
                            >
                              <Box sx={{ position: "relative", flex: "1 1 auto", minHeight: { xs: 120, md: 0 } }}>
                                <Box
                                  component="img"
                                  src={tile.thumbUrl || tile.imageUrl}
                                  alt={tile.caption ?? tile.category}
                                  sx={{ width: "100%", height: "100%", minHeight: { xs: 140, md: "100%" }, objectFit: "cover", display: "block" }}
                                />
                                <Box
                                  sx={{
                                    position: "absolute",
                                    inset: 0,
                                    pointerEvents: "none",
                                    background:
                                      "linear-gradient(165deg, rgba(0,0,0,0.2) 0%, transparent 38%, rgba(0,0,0,0.62) 100%)",
                                  }}
                                />
                                <Box
                                  sx={{
                                    position: "absolute",
                                    left: 10,
                                    right: 10,
                                    bottom: 10,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 0.35,
                                  }}
                                >
                                  <MsqdxTypography
                                    variant="caption"
                                    sx={{
                                      color: "common.white",
                                      fontWeight: 700,
                                      letterSpacing: "0.04em",
                                      lineHeight: 1.25,
                                      textShadow: "0 1px 3px rgba(0,0,0,0.55)",
                                    }}
                                  >
                                    {moodboardCategoryMoodLine(tile.category, locale)}
                                  </MsqdxTypography>
                                  <MsqdxTypography
                                    variant="caption"
                                    sx={{
                                      color: "rgba(255,255,255,0.92)",
                                      fontWeight: 800,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.08em",
                                      textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                                    }}
                                  >
                                    {tile.category}
                                  </MsqdxTypography>
                                </Box>
                              </Box>
                              <Box sx={{ p: 1, flexShrink: 0 }}>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    {tile.category}
                                  </MsqdxTypography>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                    <Tooltip title="Edit tile">
                                      <span>
                                        <MsqdxGlassEditButton onClick={() => openTileDialog(tile)} size="small" fontSize={14} />
                                      </span>
                                    </Tooltip>
                                    <Tooltip title="Delete tile">
                                      <span>
                                        <MsqdxButton
                                          variant="text"
                                          size="small"
                                          brandColor="pink"
                                          onClick={() => void handleDeleteTile(tile)}
                                          sx={{ minWidth: 28, width: 28, height: 28, p: 0, borderRadius: "rounded" }}
                                        >
                                          <MsqdxIcon name="delete" customSize={16} />
                                        </MsqdxButton>
                                      </span>
                                    </Tooltip>
                                  </Box>
                                </Box>
                                <MsqdxTypography variant="body2" sx={{ mt: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {tile.caption?.trim() ? tile.caption : "—"}
                                </MsqdxTypography>
                                {tile.locked ? (
                                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                    Locked
                                  </MsqdxTypography>
                                ) : null}
                              </Box>
                            </Box>
                          ));
                        })()}
                      </Box>
                    ) : moodboard ? (
                      <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                        No tiles yet.
                      </MsqdxTypography>
                    ) : (
                      <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                        Generate a moodboard to visualize this persona.
                      </MsqdxTypography>
                    )}
                  </Box>
                </MsqdxDashboardCard>
              </Box>

              {/* Card: Erweitert */}
              <MsqdxGlassAdvancedCard
                profile={detail.profile}
                expanded={isAccordionExpanded("advanced")}
                onToggle={toggleAccordion}
              />
            </div>
          </div>
        )}
      </section>

      <Dialog open={tileDialogOpen} onClose={() => setTileDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Moodboard tile</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {activeTile ? (
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 1.5 }}>
              <Box
                component="img"
                src={activeTile.imageUrl}
                alt={activeTile.caption ?? activeTile.category}
                sx={{ width: "100%", borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}
              />
              <Box>
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.5 }}>
                  Caption
                </MsqdxTypography>
                <MsqdxFormField
                  label="Caption"
                  value={tileEditCaption}
                  placeholder="Short label"
                  onChange={(e) => setTileEditCaption((e.target as HTMLInputElement).value)}
                />
              </Box>
              <Box>
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.5 }}>
                  Rationale
                </MsqdxTypography>
                <MsqdxFormField
                  label="Rationale"
                  value={tileEditRationale}
                  placeholder="Why this fits the persona"
                  onChange={(e) => setTileEditRationale((e.target as HTMLInputElement).value)}
                />
              </Box>
              <FormControlLabel
                control={<Checkbox checked={tileEditLocked} onChange={(e) => setTileEditLocked(e.target.checked)} />}
                label="Locked (keep on regenerate)"
              />
              {(activeTile.attributionText || activeTile.sourceUrl) && (
                <Box sx={{ p: 1, border: "1px dashed", borderColor: "divider", borderRadius: 1.5 }}>
                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                    {activeTile.attributionText ?? activeTile.sourceUrl}
                  </MsqdxTypography>
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <MsqdxButton variant="outlined" size="small" onClick={() => setTileDialogOpen(false)} disabled={tileSavePending}>
            {t("common.cancel")}
          </MsqdxButton>
          <MsqdxButton variant="contained" size="small" onClick={() => void handleSaveTile()} disabled={tileSavePending}>
            {tileSavePending ? "Saving…" : "Save"}
          </MsqdxButton>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("personaAdmin.deleteDialogTitle")}</DialogTitle>
        <DialogContent>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
            {t("personaAdmin.deleteDialogDescription", {
              name: detail?.profile.name || t("personaAdmin.thisPersona"),
            })}
          </MsqdxTypography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <MsqdxButton variant="outlined" size="small" onClick={() => setDeleteDialogOpen(false)} disabled={savePending}>
            {t("common.cancel")}
          </MsqdxButton>
          <MsqdxButton variant="contained" size="small" brandColor="pink" onClick={() => void handleDeleteConfirm()} disabled={savePending}>
            {t("personaAdmin.deleteDialogConfirm")}
          </MsqdxButton>
        </DialogActions>
      </Dialog>
    </div>
  );
};

MsqdxGlassPersonaAdminPanel.displayName = "msqdx-glass-persona-admin-panel";
