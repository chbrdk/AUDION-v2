"use client";

import type { ChangeEvent, FormEvent } from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PersonaListItem, PersonaListResponse, PersonaProfile, PersonaResponse } from "@msqdx-glass/types";

import { MsqdxIcon, MsqdxButton, MsqdxChip, MsqdxTypography, MsqdxCard, MsqdxFormField, MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassAiButtonIcon } from "./generic/msqdx-glass-ai-button-icon";
import {
  MsqdxGlassBioCard,
  MsqdxGlassPersonalityCard,
  MsqdxGlassPainPointsGoalsCard,
  MsqdxGlassCommunicationCard,
  MsqdxGlassKnowledgeSourcesCard,
  MsqdxGlassAdvancedCard,
  MsqdxGlassDashboardCardSection,
} from "./dashboard-cards";
import { MsqdxGlassEntityEditor, MsqdxGlassFieldEditor, MsqdxGlassEditButton } from "./generic";
import { getFieldDefinitions } from "@msqdx-glass/types";
import { useAiAssist } from "../hooks/use-ai-assist";
import { MsqdxGlassCollapsiblePanel } from "./admin/msqdx-glass-collapsible-panel";
import { Box } from "@mui/material";
import { buildApiUrl } from "../app/api/_lib/backend";
import { THEME_ACCENT } from "../lib/theme-accent";
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

type PersonaSaveUpdates = Partial<EditFormState> | Partial<PersonaProfile> | { project_id?: string; target_group_id?: string | null };

const defaultEditFormState: EditFormState = {
  name: "",
  headline: "",
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

const statusChipConfig: Record<string, { brandColor: "orange" | "green" | "purple" }> = {
  draft: { brandColor: "orange" },
  published: { brandColor: "green" },
  archived: { brandColor: "purple" },
};

export const MsqdxGlassPersonaAdminPanel = ({
  initialList,
  docsUrl,
  mode = "full",
  activePersonaId = null,
}: MsqdxGlassPersonaAdminPanelProps) => {
  const { activeProjectId, activeProject, projects } = useProject();
  const { t } = useI18n();
  const accent = "var(--color-theme-accent)";

  const getStatusLabel = (status: string) => {
    const key = status === "draft" ? "personaAdmin.statuses.draft" : status === "published" ? "personaAdmin.statuses.published" : "personaAdmin.statuses.archived";
    return t(key);
  };
  const [list, setList] = useState<PersonaListResponse>(initialList);
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
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormState>(defaultKnowledgeForm);
  const [knowledgePending, setKnowledgePending] = useState(false);
  const { execute: runPersonaAiAssist, loading: personaAiLoading } = useAiAssist();
  const [personaAiError, setPersonaAiError] = useState<string | null>(null);
  const [recentTraitHighlights, setRecentTraitHighlights] = useState<string[]>([]);
  const [recentVocabularyHighlights, setRecentVocabularyHighlights] = useState<string[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(
    new Set([
      "metadata",
      "persona-basics",
      "bio-demographics",
      "personality-values",
      "pain-points-goals",
      "communication",
      "knowledge-sources",
      "advanced"
    ])
  );
  const [targetGroupsForMetadata, setTargetGroupsForMetadata] = useState<TargetGroupResponse[]>([]);
  const [metadataAssignPending, setMetadataAssignPending] = useState(false);
  const documentInputRef = useRef<HTMLInputElement | null>(null);

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
        setDetailLoading(false);
      }
    },
    [activeProjectId, t]
  );

  const refreshList = useCallback(async () => {
    if (!activeProjectId) {
      setList({ items: [], total: 0, page: 1, page_size: 50 });
      setSelectedId(null);
      setDetail(null);
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
      const payload = (await response.json()) as PersonaListResponse;
      setList(payload);
      if (!payload.items.find((item) => item.id === selectedId)) {
        setSelectedId(payload.items[0]?.id ?? null);
      }
      notify(t("personaAdmin.toasts.listUpdated"));
    } catch (error) {
      console.error("Persona list refresh failed", error);
      notify(t("personaAdmin.toasts.updateFailed"));
    } finally {
      setListRefreshing(false);
    }
  }, [selectedId, activeProjectId, t]);

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

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

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

  useEffect(() => {
    const projectId = detail?.metadata?.projectId;
    if (!projectId) {
      setTargetGroupsForMetadata([]);
      return;
    }
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
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveMetadataAssignment = async (updates: { project_id?: string; target_group_id?: string | null }) => {
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

  const handleSave = async (updates?: PersonaSaveUpdates) => {
    if (!selectedId || !detail) {
      return;
    }
    setSavePending(true);
    try {
      // Check if updates contain demographic fields (PersonaProfile fields)
      const hasDemographicFields = updates && (
        'age' in updates ||
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
        'goals' in updates
      );

      let formUpdates: Partial<EditFormState> | undefined;
      let demographicUpdates: Partial<PersonaProfile> | undefined;

      if (hasDemographicFields) {
        // Updates are demographic fields
        demographicUpdates = updates as Partial<PersonaProfile>;
      } else {
        // Updates are form fields
        formUpdates = updates as Partial<EditFormState>;
      }

      // Merge basic form updates
      const updatedName = formUpdates?.name ?? editForm.name;
      const updatedHeadline = formUpdates?.headline ?? editForm.headline;
      const updatedSegment = formUpdates?.segment ?? editForm.segment;
      const updatedStatus = formUpdates?.status ?? editForm.status;
      const updatedBy = formUpdates?.updatedBy ?? editForm.updatedBy ?? "persona-admin-ui";

      // Prepare profile updates - preserve existing values and merge new ones
      const profileUpdates: Partial<PersonaProfile> = {
        ...detail.profile,
        name: updatedName,
        headline: updatedHeadline,
        segment: updatedSegment,
      };

      // Merge demographic updates (explicitly set values, including null)
      if (demographicUpdates) {
        // Explicitly handle each demographic field to ensure they are set
        if ('age' in demographicUpdates) {
          profileUpdates.age = demographicUpdates.age;
        }
        if ('location' in demographicUpdates) {
          profileUpdates.location = demographicUpdates.location ?? null;
        }
        if ('gender' in demographicUpdates) {
          // Explicitly set gender, even if it's an empty string (convert to null)
          const genderValue = demographicUpdates.gender;
          profileUpdates.gender = (genderValue && genderValue.trim() !== "") ? genderValue : null;
        }
        if ('media_affinity' in demographicUpdates) {
          profileUpdates.media_affinity = demographicUpdates.media_affinity;
        }
        if ('full_name' in demographicUpdates) {
          profileUpdates.full_name = demographicUpdates.full_name ?? null;
        }
        // Handle other fields
        Object.keys(demographicUpdates).forEach((key) => {
          if (!['age', 'location', 'gender', 'media_affinity', 'full_name', 'name', 'headline', 'segment'].includes(key)) {
            const value = demographicUpdates[key as keyof PersonaProfile];
            if (value !== undefined) {
              (profileUpdates as any)[key] = value;
            }
          }
        });
      }

      // Ensure we send the complete profile, not just updates
      // Start with the existing profile and apply all updates
      const completeProfile: PersonaProfile = {
        ...detail.profile,
        // Override with form updates first
        name: updatedName,
        headline: updatedHeadline,
        segment: updatedSegment,
      };

      // ALWAYS ensure optional demographic fields exist (even if null) so they're included in JSON
      // JSON.stringify excludes undefined but includes null, so we need to explicitly set them
      // We MUST set them as properties, not just check - use existing value or null
      const existingGender = detail.profile?.gender;
      const existingAge = detail.profile?.age;
      const existingLocation = detail.profile?.location;
      const existingMediaAffinity = detail.profile?.media_affinity;
      const existingFullName = detail.profile?.full_name;

      // Explicitly assign to ensure they're properties (not undefined)
      completeProfile.gender = completeProfile.gender ?? existingGender ?? null;
      completeProfile.age = completeProfile.age ?? existingAge ?? null;
      completeProfile.location = completeProfile.location ?? existingLocation ?? null;
      completeProfile.media_affinity = completeProfile.media_affinity ?? existingMediaAffinity ?? null;
      completeProfile.full_name = completeProfile.full_name ?? existingFullName ?? null;

      // Apply demographic updates explicitly to ensure they override existing values
      if (demographicUpdates) {
        if ('age' in demographicUpdates) {
          completeProfile.age = demographicUpdates.age;
        }
        if ('location' in demographicUpdates) {
          completeProfile.location = demographicUpdates.location ?? null;
        }
        if ('gender' in demographicUpdates) {
          // Explicitly set gender, even if it's null or empty string
          const genderValue = demographicUpdates.gender;
          const finalGender = (genderValue && typeof genderValue === 'string' && genderValue.trim() !== "") ? genderValue : null;
          completeProfile.gender = finalGender;
          console.log('[DEBUG] Setting gender:', { genderValue, finalGender, hasGender: 'gender' in completeProfile });
        }
        if ('media_affinity' in demographicUpdates) {
          completeProfile.media_affinity = demographicUpdates.media_affinity;
        }
        if ('full_name' in demographicUpdates) {
          completeProfile.full_name = demographicUpdates.full_name ?? null;
        }
        // Merge any other demographic fields
        Object.keys(demographicUpdates).forEach((key) => {
          if (!['age', 'location', 'gender', 'media_affinity', 'full_name', 'name', 'headline', 'segment'].includes(key)) {
            const value = demographicUpdates[key as keyof PersonaProfile];
            if (value !== undefined) {
              (completeProfile as any)[key] = value;
            }
          }
        });
      }

      // Also apply profileUpdates for any other fields that were set
      if (profileUpdates) {
        Object.keys(profileUpdates).forEach((key) => {
          if (!['name', 'headline', 'segment'].includes(key)) {
            const value = profileUpdates[key as keyof PersonaProfile];
            if (value !== undefined) {
              (completeProfile as any)[key] = value;
            }
          }
        });
      }

      // CRITICAL: Ensure all demographic fields are explicitly present in the profile (even if null)
      // This is important because JSON.stringify will omit undefined fields but include null fields
      // We must set them BEFORE serialization to ensure they're sent to the backend
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

      // FINAL check: Force all demographic fields to be explicitly set (even if null)
      // This is critical because JSON.stringify() omits undefined but includes null
      // We MUST set them as properties (not just check if they exist) to ensure serialization
      Object.assign(completeProfile, {
        gender: completeProfile.gender ?? null,
        age: completeProfile.age ?? null,
        location: completeProfile.location ?? null,
        media_affinity: completeProfile.media_affinity ?? null,
        full_name: completeProfile.full_name ?? null,
      });

      // Debug logging - log the complete payload AFTER ensuring all fields are set
      console.log('[DEBUG] Sending payload:', {
        hasProfile: !!completeProfile,
        profileKeys: Object.keys(completeProfile || {}),
        gender: completeProfile?.gender,
        genderType: typeof completeProfile?.gender,
        age: completeProfile?.age,
        location: completeProfile?.location,
        media_affinity: completeProfile?.media_affinity,
        demographicUpdates: demographicUpdates,
        hasGenderInProfile: 'gender' in completeProfile,
        hasMediaAffinityInProfile: 'media_affinity' in completeProfile,
        completeProfile: JSON.stringify(completeProfile, null, 2),
      });

      const payload: Record<string, unknown> = {
        name: updatedName,
        headline: updatedHeadline,
        segment: updatedSegment,
        status: updatedStatus,
        updated_by: updatedBy,
        profile: completeProfile,
      };
      if (detail.metadata) {
        payload.project_id = (updates as { project_id?: string })?.project_id ?? detail.metadata.projectId;
        payload.target_group_id = (updates as { target_group_id?: string | null })?.target_group_id !== undefined
          ? (updates as { target_group_id?: string | null }).target_group_id
          : (detail.metadata.targetGroupId ?? null);
      }

      console.log('[DEBUG] Payload JSON:', JSON.stringify(payload, null, 2));
      console.log('[DEBUG] Profile keys before send:', Object.keys(completeProfile));
      console.log('[DEBUG] Gender in profile before send:', 'gender' in completeProfile, completeProfile.gender);


      // Update local form state if we have form updates
      if (formUpdates) {
        if (formUpdates.name !== undefined) handleEditField("name", formUpdates.name);
        if (formUpdates.headline !== undefined) handleEditField("headline", formUpdates.headline);
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
        console.error('[DEBUG] Save failed:', response.status, errorText);
        throw new Error(`Backend responded with ${response.status}: ${errorText}`);
      }
      const updated = (await response.json()) as PersonaResponse;
      console.log('[DEBUG] Received response:', {
        hasProfile: !!updated.profile,
        profileKeys: Object.keys(updated.profile || {}),
        gender: updated.profile?.gender,
        age: updated.profile?.age,
        location: updated.profile?.location,
        media_affinity: updated.profile?.media_affinity,
      });
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

  const handleDemographicSave = async (updates: Partial<PersonaProfile>) => {
    console.log('[DEBUG handleDemographicSave] Received updates:', updates);
    console.log('[DEBUG handleDemographicSave] Updates keys:', Object.keys(updates || {}));
    console.log('[DEBUG handleDemographicSave] Gender:', updates?.gender, 'Type:', typeof updates?.gender);
    console.log('[DEBUG handleDemographicSave] Media affinity:', updates?.media_affinity, 'Type:', typeof updates?.media_affinity);
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
      const payload = {
        project_id: activeProjectId,
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

  const handleDelete = async () => {
    if (!selectedId || !detail) {
      return;
    }

    const personaName = detail.profile.name || t("personaAdmin.thisPersona");
    const confirmed = window.confirm(
      t("personaAdmin.deleteConfirm", { name: personaName })
    );

    if (!confirmed) {
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
              const config = statusChipConfig[item.status] ?? statusChipConfig.draft;
              const statusLabel = getStatusLabel(item.status);
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
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                      <MsqdxTypography variant="subtitle1" weight="semibold">
                        {item.name}
                      </MsqdxTypography>
                      <MsqdxChip variant="filled" brandColor={config.brandColor} label={statusLabel} size="small" />
                    </Box>
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

              {/* Hero Card: Persona Header + Biography + Demographics */}
              <Box sx={{ gridColumn: "1 / -1" }}>
                <MsqdxDashboardCard
                  id="bio-demographics"
                  title={t("personaAdmin.bioDemographics")}
                  icon="person"
                  iconColor={{ color: THEME_ACCENT.color }}
                  expanded={isAccordionExpanded("bio-demographics")}
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
                        const headlineField = fieldDefinitions.find(f => f.key === "headline");
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
                              {headlineField && (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  {editingField === "headline" ? (
                                    <Box sx={{ flex: 1 }}>
                                      <MsqdxGlassFieldEditor
                                        field={headlineField}
                                        value={detail.profile.headline}
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
                                      <span style={{ fontSize: "1rem", color: "var(--color-text-secondary)" }}>{detail.profile.headline || "—"}</span>
                                      <MsqdxGlassEditButton onClick={() => setEditingField("headline")} disabled={savePending} aria-label="Edit headline" size="small" fontSize={14} />
                                    </>
                                  )}
                                </div>
                              )}
                              {segmentField && (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  {editingField === "segment" ? (
                                    <Box sx={{ flex: 1 }}>
                                      <MsqdxGlassFieldEditor
                                        field={segmentField}
                                        value={detail.profile.segment}
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
                            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mt: 1, flexWrap: "wrap" }}>
                              <MsqdxButton variant="text" size="small" onClick={handleGenerateAvatar} disabled={avatarGeneratePending} startIcon={<MsqdxIcon name="photo_camera" customSize={16} />}>
                                {avatarGeneratePending ? t("personaAdmin.generatingAvatar") : t("personaAdmin.generateAvatar")}
                              </MsqdxButton>
                              <MsqdxButton variant="text" size="small" onClick={handleArchive} disabled={savePending} startIcon={<MsqdxIcon name="archive" customSize={16} />}>
                                {t("personaAdmin.archive")}
                              </MsqdxButton>
                              <MsqdxButton variant="text" size="small" onClick={handleDelete} disabled={savePending} brandColor="pink" startIcon={<MsqdxIcon name="delete" customSize={16} />}>
                                {t("personaAdmin.delete")}
                              </MsqdxButton>
                            </Box>
                          </div>
                        );
                      })()}
                    </Box>
                  </Box>
                  {detail.profile.bio && (
                    <MsqdxGlassDashboardCardSection title={t("personaAdmin.biography")}>
                      <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap", margin: 0 }}>
                        {detail.profile.bio}
                      </p>
                    </MsqdxGlassDashboardCardSection>
                  )}
                  <MsqdxGlassDashboardCardSection title={t("personaAdmin.demographics")}>
                    <MsqdxGlassEntityEditor
                      entityType="persona"
                      entity={detail.profile}
                      onSave={async (updates) => {
                        await handleDemographicSave(updates as Partial<PersonaProfile>);
                      }}
                      inline={true}
                      fieldOverrides={{ name: undefined, headline: undefined, segment: undefined }}
                    />
                  </MsqdxGlassDashboardCardSection>
                </MsqdxDashboardCard>
              </Box>

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
                    <Box>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                        {t("personaAdmin.status")}
                      </MsqdxTypography>
                      <MsqdxTypography variant="body2" weight="medium">{detail.metadata.status}</MsqdxTypography>
                    </Box>
                    <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                        {t("personaAdmin.confidence")}
                      </MsqdxTypography>
                      <MsqdxTypography variant="body2" weight="medium">{detail.metadata.confidence.toFixed(2)}</MsqdxTypography>
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

              {/* Card: Persönlichkeit & Werte - 50% width */}
              <MsqdxGlassPersonalityCard
                profile={detail.profile}
                expanded={isAccordionExpanded("personality-values")}
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
    </div>
  );
};

MsqdxGlassPersonaAdminPanel.displayName = "msqdx-glass-persona-admin-panel";
