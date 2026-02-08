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
import { BRAND_COLOR } from "../lib/branding";

type MsqdxGlassPersonaAdminPanelProps = {
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

const statusChipConfig: Record<string, { label: string; brandColor: "orange" | "green" | "purple" }> = {
  draft: { label: "Draft", brandColor: "orange" },
  published: { label: "Published", brandColor: "green" },
  archived: { label: "Archived", brandColor: "purple" },
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

// Removed unused personaBackendPublicBase constant to prevent Mixed Content errors

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

export const MsqdxGlassPersonaAdminPanel = ({ initialList, docsUrl }: MsqdxGlassPersonaAdminPanelProps) => {
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
  const documentInputRef = useRef<HTMLInputElement | null>(null);

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
        const response = await fetch(buildApiUrl(`/api/persona-admin/${personaId}`), { cache: "no-store" });
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
      const response = await fetch(buildApiUrl("/api/persona-admin"), { cache: "no-store" });
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

  const handleEditField = (field: keyof EditFormState, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async (updates?: Partial<EditFormState> | Partial<PersonaProfile>) => {
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

      const payload = {
        name: updatedName,
        headline: updatedHeadline,
        segment: updatedSegment,
        status: updatedStatus,
        updated_by: updatedBy,
        profile: completeProfile,
      };

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

      notify("Persona saved");
    } catch (error) {
      console.error("Persona save failed", error);
      notify("Save failed");
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
        : "Keine Interests definiert";

      // Build target group summary
      const targetGroupSummary = detail.profile.segment || "Keine Target Group definiert";

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
        setPersonaAiError("Keine AI Vorschläge erhalten.");
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
        setPersonaAiError("Keine gültigen Interests generiert.");
        return;
      }
      await handleSaveInterests(merged);
      notify("AI Interests hinzugefügt");
    } catch (error) {
      setPersonaAiError(error instanceof Error ? error.message : "AI Anfrage fehlgeschlagen");
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
        : "Keine Values definiert";

      // Build target group summary
      const targetGroupSummary = detail.profile.segment || "Keine Target Group definiert";

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
        setPersonaAiError("Keine AI Vorschläge erhalten.");
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
        setPersonaAiError("Keine gültigen Values generiert.");
        return;
      }
      await handleSaveValues(merged);
      notify("AI Values hinzugefügt");
    } catch (error) {
      setPersonaAiError(error instanceof Error ? error.message : "AI Anfrage fehlgeschlagen");
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
      notify("No persona selected");
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
        : "Keine Traits definiert";

      // Build graph relationships summary
      const graphRelationshipsSummary = detail.insights && detail.insights.graphRelationships && detail.insights.graphRelationships.length > 0
        ? detail.insights.graphRelationships
          .map(rel => `${rel.relationship}: [${rel.nodes.join(", ")}]`)
          .join("\n")
        : "Keine Graph-Relationen verfügbar";

      // Build knowledge context summary (using chunk IDs for now)
      const knowledgeContext = detail.insights && detail.insights.relatedChunkIds && detail.insights.relatedChunkIds.length > 0
        ? `Verfügbar: ${detail.insights.relatedChunkIds.length} Research-Chunks verknüpft mit dieser Persona.`
        : "Keine Research-Chunks verfügbar";

      // Build target group summary (placeholder - would need to fetch target group)
      const targetGroupSummary = detail.profile.segment || "Keine Target Group definiert";

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
          notify(`Added ${newTraits.length} new trait(s) via AI`);
        } else {
          notify("No new traits generated");
        }
      } else {
        notify("AI konnte keine Traits generieren");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate traits with AI";
      setPersonaAiError(errorMessage);
      notify(errorMessage);
    }
  };

  const handleAiSuggestVocabulary = async () => {
    if (!detail) {
      notify("No persona selected");
      return;
    }

    try {
      setPersonaAiError(null);

      // Build existing vocabulary summary
      const existingVocabulary = detail.profile.communication_style?.vocabulary || [];
      const existingVocabularySummary = existingVocabulary.length > 0
        ? existingVocabulary.join(", ")
        : "Kein Vokabular definiert";

      // Build graph relationships summary
      const graphRelationshipsSummary = detail.insights && detail.insights.graphRelationships && detail.insights.graphRelationships.length > 0
        ? detail.insights.graphRelationships
          .map(rel => `${rel.relationship}: [${rel.nodes.join(", ")}]`)
          .join("\n")
        : "Keine Graph-Relationen verfügbar";

      // Build knowledge context summary (using chunk IDs for now)
      const knowledgeContext = detail.insights && detail.insights.relatedChunkIds && detail.insights.relatedChunkIds.length > 0
        ? `Verfügbar: ${detail.insights.relatedChunkIds.length} Research-Chunks verknüpft mit dieser Persona.`
        : "Keine Research-Chunks verfügbar";

      // Build target group summary (placeholder - would need to fetch target group)
      const targetGroupSummary = detail.profile.segment || "Keine Target Group definiert";

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
          notify(`Added ${newVocabulary.length} new vocabulary word(s) via AI`);
        } else {
          notify("No new vocabulary generated");
        }
      } else {
        notify("AI konnte kein Vokabular generieren");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate vocabulary with AI";
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
        setPersonaAiError("Keine AI Vorschläge erhalten.");
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
        setPersonaAiError("Keine gültigen Pain Points generiert.");
        return;
      }
      await handleSavePainPoints(merged);
      notify("AI Pain Points hinzugefügt");
    } catch (error) {
      setPersonaAiError(error instanceof Error ? error.message : "AI Anfrage fehlgeschlagen");
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
        : "Keine Goals definiert";

      // Build target group summary
      const targetGroupSummary = detail.profile.segment || "Keine Target Group definiert";

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
        setPersonaAiError("Keine AI Vorschläge erhalten.");
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
        setPersonaAiError("Keine gültigen Goals generiert.");
        return;
      }
      await handleSaveGoals(merged);
      notify("AI Goals hinzugefügt");
    } catch (error) {
      setPersonaAiError(error instanceof Error ? error.message : "AI Anfrage fehlgeschlagen");
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
      const response = await fetch(buildApiUrl(`/api/persona-admin/${selectedId}?actor=persona-admin-ui`), {
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

  const handleDelete = async () => {
    if (!selectedId || !detail) {
      return;
    }

    const personaName = detail.profile.name || "this persona";
    const confirmed = window.confirm(
      `Are you sure you want to delete "${personaName}"?\n\nThis action cannot be undone. The persona will be permanently removed.`
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
      notify("Persona deleted");
    } catch (error) {
      console.error("Persona delete failed", error);
      notify("Delete failed");
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
      let payload: { status?: string; detail?: string; message?: string } | null = null;
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
        notify("Avatar generation failed. Please check the image service configuration.");
        return;
      }
      await loadDetail(selectedId);
      notify("Avatar generated");
    } catch (error) {
      console.error("Avatar generation failed", error);
      notify((error as Error)?.message || "Failed to generate avatar");
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
      notify("Wissenseintrag hinzugefügt");
    } catch (error) {
      console.error("Knowledge add failed", error);
      notify("Failed to save knowledge");
    } finally {
      setKnowledgePending(false);
    }
  };

  return (
    <div className="msqdx-glass-admin-grid">
      <MsqdxGlassCollapsiblePanel title="Personas" defaultExpanded={true}>
        <section className="msqdx-glass-panel">
          <header className="msqdx-glass-panel__header">
            <div>
              <MsqdxTypography variant="h5" weight="semibold">Personas</MsqdxTypography>
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>{list.total} entries</MsqdxTypography>
            </div>
            <MsqdxButton variant="text" size="small" onClick={refreshList} disabled={listRefreshing} startIcon={<MsqdxIcon name="refresh" customSize={16} />}>
              Refresh
            </MsqdxButton>
          </header>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {list.items.length === 0 && (
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                No personas available yet.
              </MsqdxTypography>
            )}
            {list.items.map((item) => {
              const config = statusChipConfig[item.status] ?? statusChipConfig.draft;
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
                    width: "100%",
                    borderColor: selectedId === item.id ? "primary.main" : undefined,
                    borderWidth: selectedId === item.id ? 2 : undefined,
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                      <MsqdxTypography variant="subtitle1" weight="semibold">
                        {item.name}
                      </MsqdxTypography>
                      <MsqdxChip variant="filled" brandColor={config.brandColor} label={config.label} size="small" />
                    </Box>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                      {item.segment} · Version {item.version}
                    </MsqdxTypography>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                      Last updated {formatDate(item.updatedAt)}
                    </MsqdxTypography>
                  </Box>
                </MsqdxCard>
              );
            })}
          </Box>
          <MsqdxCard variant="flat" sx={{ mt: 2, p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
            <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
              New Persona
            </MsqdxTypography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <MsqdxFormField
                label="Project ID"
                value={createForm.projectId}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, projectId: e.target.value }))}
                placeholder="123e4567-e89b-12d3-a456-426614174000"
                fullWidth
                size="small"
              />
              <MsqdxFormField
                label="Name"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Persona Name"
                fullWidth
                size="small"
              />
              <MsqdxFormField
                label="Segment"
                value={createForm.segment}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, segment: e.target.value }))}
                placeholder="B2B / Enterprise / etc."
                fullWidth
                size="small"
              />
              <MsqdxFormField
                label="Headline"
                value={createForm.headline}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, headline: e.target.value }))}
                placeholder="Kurzbeschreibung"
                fullWidth
                size="small"
              />
              <MsqdxButton
                variant="contained"
                brandColor="green"
                size="small"
                onClick={handleCreate}
                disabled={createPending}
                startIcon={<MsqdxIcon name="add" customSize={16} />}
              >
                Persona anlegen
              </MsqdxButton>
            </Box>
          </MsqdxCard>
        </section>
      </MsqdxGlassCollapsiblePanel>

      <section className="msqdx-glass-panel">
        {!selectedId && <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>Please select a persona.</MsqdxTypography>}
        {selectedId && detailLoading && <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>Lade Persona...</MsqdxTypography>}
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
                  title="Biography & Demographics"
                  icon="person"
                  brandColor={BRAND_COLOR}
                  iconColor={{ color: "var(--color-theme-accent)" }}
                  expanded={isAccordionExpanded("bio-demographics")}
                  onToggle={toggleAccordion}
                >
                  <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", mb: 2 }}>
                    <div className="msqdx-glass-avatar" style={{ flexShrink: 0 }}>
                      {detail.metadata.avatarUrl ? (
                        <img src={detail.metadata.avatarUrl} alt={`${detail.profile.name} Avatar`} />
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
                        const handleFieldChange = () => {};
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
                                {avatarGeneratePending ? "Generating..." : "Generate avatar"}
                              </MsqdxButton>
                              <MsqdxButton variant="text" size="small" onClick={handleArchive} disabled={savePending} startIcon={<MsqdxIcon name="archive" customSize={16} />}>
                                Archive
                              </MsqdxButton>
                              <MsqdxButton variant="text" size="small" onClick={handleDelete} disabled={savePending} brandColor="pink" startIcon={<MsqdxIcon name="delete" customSize={16} />}>
                                Delete
                              </MsqdxButton>
                            </Box>
                          </div>
                        );
                      })()}
                    </Box>
                  </Box>
                  {detail.profile.bio && (
                    <MsqdxGlassDashboardCardSection title="Biography">
                      <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap", margin: 0 }}>
                        {detail.profile.bio}
                      </p>
                    </MsqdxGlassDashboardCardSection>
                  )}
                  {(detail.profile.full_name || detail.profile.age || detail.profile.location || detail.profile.gender || (detail.profile.media_affinity !== null && detail.profile.media_affinity !== undefined)) && (
                    <MsqdxGlassDashboardCardSection title="Demographics">
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
                  )}
                </MsqdxDashboardCard>
              </Box>

              {/* Card: Metadata - full width */}
              <Box sx={{ gridColumn: "1 / -1" }}>
              <MsqdxDashboardCard
                id="metadata"
                title="Metadata"
                icon="info"
                brandColor={BRAND_COLOR}
                iconColor={{ color: "var(--color-theme-accent)" }}
                expanded={isAccordionExpanded("metadata")}
                onToggle={toggleAccordion}
              >
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
                      Status
                    </MsqdxTypography>
                    <MsqdxTypography variant="body2" weight="medium">{detail.metadata.status}</MsqdxTypography>
                  </Box>
                  <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                      Confidence
                    </MsqdxTypography>
                    <MsqdxTypography variant="body2" weight="medium">{detail.metadata.confidence.toFixed(2)}</MsqdxTypography>
                  </Box>
                  <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                      Version
                    </MsqdxTypography>
                    <MsqdxTypography variant="body2" weight="medium">{detail.metadata.version}</MsqdxTypography>
                  </Box>
                  <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                      Updated
                    </MsqdxTypography>
                    <MsqdxTypography variant="body2" weight="medium">{formatDate(detail.metadata.updatedAt)}</MsqdxTypography>
                  </Box>
                  <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                      Updated by
                    </MsqdxTypography>
                    <MsqdxTypography variant="body2" weight="medium">{detail.metadata.updatedBy ?? "—"}</MsqdxTypography>
                  </Box>
                  <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                      Last review
                    </MsqdxTypography>
                    <MsqdxTypography variant="body2" weight="medium">{formatDate(detail.metadata.lastReviewedAt)}</MsqdxTypography>
                  </Box>
                  {detail.profile.created_at && (
                    <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                        Created at
                      </MsqdxTypography>
                      <MsqdxTypography variant="body2" weight="medium">{formatDate(detail.profile.created_at)}</MsqdxTypography>
                    </Box>
                  )}
                  {detail.profile.targetGroupId && (
                    <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1.5 }}>
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                        Target Group
                      </MsqdxTypography>
                      <MsqdxButton
                        variant="text"
                        size="small"
                        component="a"
                        href={`/target-groups/admin?selected=${detail.profile.targetGroupId}`}
                        sx={{ fontSize: "0.875rem", p: "4px 8px" }}
                        startIcon={<MsqdxIcon name="groups" customSize={14} />}
                      >
                        To Target Group
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
              {((detail.profile.pain_points && detail.profile.pain_points.length > 0) ||
                (detail.profile.goals && detail.profile.goals.length > 0)) && (
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
                )}

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

