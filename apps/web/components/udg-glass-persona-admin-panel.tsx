"use client";

import type { ChangeEvent, FormEvent } from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import clsx from "clsx";

import type { PersonaListItem, PersonaListResponse, PersonaProfile, PersonaResponse } from "@udg-glass/types";

import { MaterialSymbol } from "./material-symbol";
import { UdgGlassAiButton } from "./ai/udg-glass-ai-button";
import {
  UdgGlassPersonaBasicsCard,
  UdgGlassBioCard,
  UdgGlassPersonalityCard,
  UdgGlassPainPointsGoalsCard,
  UdgGlassCommunicationCard,
  UdgGlassKnowledgeSourcesCard,
  UdgGlassAdvancedCard,
  UdgGlassDashboardCard,
  UdgGlassDashboardCardSection,
} from "./dashboard-cards";
import { UdgGlassEntityEditor } from "./generic";
import { useAiAssist } from "../hooks/use-ai-assist";
import { UdgGlassCollapsiblePanel } from "./admin/udg-glass-collapsible-panel";
import { Box } from "@mui/material";

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
  const [avatarGeneratePending, setAvatarGeneratePending] = useState(false);
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormState>(defaultKnowledgeForm);
  const [knowledgePending, setKnowledgePending] = useState(false);
  const { execute: runPersonaAiAssist, loading: personaAiLoading } = useAiAssist();
  const [personaAiError, setPersonaAiError] = useState<string | null>(null);
  const [recentTraitHighlights, setRecentTraitHighlights] = useState<string[]>([]);
  const [recentVocabularyHighlights, setRecentVocabularyHighlights] = useState<string[]>([]);
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

      const response = await fetch(`/api/persona-admin/${selectedId}`, {
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

  const handleSaveValues = async (chips: string[]) => {
    await handleDemographicSave({ values: chips });
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
      const response = await fetch(`/api/persona-admin/${selectedId}?actor=persona-admin-ui`, {
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

  const handleGenerateAvatar = async () => {
    if (!selectedId) {
      return;
    }
    setAvatarGeneratePending(true);
    try {
      const response = await fetch(`/api/persona-admin/${selectedId}/generate-image`, {
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
      <UdgGlassCollapsiblePanel title="Personas" defaultExpanded={true}>
        <section className="udg-glass-panel">
          <header className="udg-glass-panel__header">
            <div>
              <h2>Personas</h2>
              <p>{list.total} entries</p>
            </div>
            <button className="udg-glass-button --ghost" onClick={refreshList} disabled={listRefreshing}>
              <MaterialSymbol icon="refresh" fontSize={16} /> Refresh
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
              <MaterialSymbol icon="add" fontSize={16} /> Persona anlegen
            </button>
          </div>
        </section>
      </UdgGlassCollapsiblePanel>

      <section className="udg-glass-panel">
        {!selectedId && <p className="udg-glass-empty">Please select a persona.</p>}
        {selectedId && detailLoading && <p className="udg-glass-muted">Lade Persona...</p>}
        {detailError && <p className="udg-glass-error">{detailError}</p>}
        {detail && (
          <div className="udg-glass-detail">
            <input ref={documentInputRef} type="file" className="udg-glass-sr-only" onChange={handleDocumentInputChange} />
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
                    <button className="udg-glass-button --ghost" onClick={handleGenerateAvatar} disabled={avatarGeneratePending}>
                      <MaterialSymbol icon="photo_camera" fontSize={16} /> {avatarGeneratePending ? "Generating..." : "Generate avatar"}
                    </button>
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
                onSave={(updates) => handleSave(updates)}
                onArchive={handleArchive}
                onDelete={handleDelete}
                savePending={savePending}
                formatDate={formatDate}
              />

              {/* Card: Biografie & Demographie */}
              {(detail.profile.bio || detail.profile.full_name || detail.profile.age || detail.profile.location || detail.profile.gender || (detail.profile.media_affinity !== null && detail.profile.media_affinity !== undefined)) && (
                <UdgGlassDashboardCard
                  id="bio-demographics"
                  title="Biography & Demographics"
                  icon="person"
                  variant="bio"
                  fullWidth={true}
                  iconColor={{
                    color: "var(--color-theme-accent)"
                  }}
                  borderColor="var(--color-theme-accent)"
                  expanded={isAccordionExpanded("bio-demographics")}
                  onToggle={toggleAccordion}
                >
                  {detail.profile.bio && (
                    <UdgGlassDashboardCardSection title="Biography">
                      <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap", margin: 0 }}>
                        {detail.profile.bio}
                      </p>
                    </UdgGlassDashboardCardSection>
                  )}
                  <UdgGlassDashboardCardSection title="Demographics">
                    <UdgGlassEntityEditor
                      entityType="persona"
                      entity={detail.profile}
                      onSave={async (updates) => {
                        await handleDemographicSave(updates as Partial<PersonaProfile>);
                      }}
                      inline={true}
                      fieldOverrides={{
                        // Filter out non-demographic fields
                        name: undefined,
                        headline: undefined,
                        segment: undefined,
                      }}
                    />
                  </UdgGlassDashboardCardSection>
                </UdgGlassDashboardCard>
              )}

              {/* Card: Persönlichkeit & Werte - 50% width */}
              <UdgGlassPersonalityCard
                profile={detail.profile}
                expanded={isAccordionExpanded("personality-values")}
                onToggle={toggleAccordion}
                onSaveInterests={handleSaveInterests}
                onSaveValues={handleSaveValues}
                onSaveSocialMedia={handleSaveSocialMedia}
                onSaveTraits={handleSaveTraits}
                onAiSuggestTraits={handleAiSuggestTraits}
                aiTraitsLoading={personaAiLoading}
                highlightedTraits={recentTraitHighlights}
              />

              {/* Card: Kommunikation - 50% width (nebeneinander mit Personality) */}
              {detail.profile.communication_style && (
                <UdgGlassCommunicationCard
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
                <UdgGlassPainPointsGoalsCard
                  profile={detail.profile}
                  expanded={isAccordionExpanded("pain-points-goals")}
                  onToggle={toggleAccordion}
                  onSavePainPoints={handleSavePainPoints}
                  onSaveGoals={handleSaveGoals}
                  painPointsToolbar={
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                      <UdgGlassAiButton
                        templates={[{ id: "persona.pain_points", label: "AI Pain Points", maxSuggestions: 4 }]}
                        onClick={handleGeneratePainPointIdeas}
                        disabled={personaAiLoading}
                        loading={personaAiLoading}
                        size="small"
                        title="AI Pain Points"
                      />
                      {personaAiError && <span className="udg-glass-pain-toolbar__error">{personaAiError}</span>}
                    </div>
                  }
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

