"use client";

// Disable static generation to prevent prerendering issues with useState/useContext
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  journeysApi,
  type JourneyAiGenerateRequest,
  type JourneyResponse,
  type PhaseCreate,
} from "../../../api/_lib/journeys";
import { fetchTargetGroupPersonas, type PersonaResponse } from "../../../api/_lib/target-group";
import { MsqdxIcon, MsqdxButton, MsqdxTypography, MsqdxFormField, MsqdxTextareaField, MsqdxSelect, MsqdxCard, MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassJourneyPhaseCard } from "../../../../components/journeys/msqdx-glass-phase-card";
import { BRAND_COLOR } from "../../../../lib/branding";
import { Box } from "@mui/material";
import { MsqdxGlassAiButton } from "../../../../components/ai/msqdx-glass-ai-button";
import { useAiAssist } from "../../../../hooks/use-ai-assist";

const ELEMENT_TYPE_OPTIONS = [
  "action",
  "thought",
  "feeling",
  "touchpoint",
  "pain_point",
  "opportunity",
  "question",
  "quote",
] as const;
type JourneyElementType = (typeof ELEMENT_TYPE_OPTIONS)[number];

type JourneyMomentDraft = {
  id: string; // For new elements: UUID, for existing: "element-{elementId}"
  element_type: JourneyElementType;
  content: string;
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

export default function JourneyEditorPage() {
  const params = useParams();
  const router = useRouter();
  const journeyId = params.journeyId as string;
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phaseFormExpanded, setPhaseFormExpanded] = useState(false);
  const [addingPhase, setAddingPhase] = useState(false);
  const [phaseFormData, setPhaseFormData] = useState<PhaseCreate>({
    name: "",
    description: "",
    phase_order: 1,
    expected_duration_min: undefined,
    expected_duration_max: undefined,
    duration_unit: "minutes",
    expected_emotion: undefined,
    emotion_intensity: undefined,
  });
  const [savePending, setSavePending] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [activePhaseIndex, setActivePhaseIndex] = useState(0);
  const [momentDrafts, setMomentDrafts] = useState<JourneyMomentDraft[]>([]);
  const [momentsError, setMomentsError] = useState<string | null>(null);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(() => new Set(["metadata"]));
  const { execute: runAiAssist, loading: aiAssistLoading } = useAiAssist();

  const isAccordionExpanded = (id: string) => expandedAccordions.has(id);
  const toggleAccordion = (id: string) =>
    setExpandedAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    if (journeyId) {
      loadJourney();
    }
  }, [journeyId]);

  const loadJourney = async () => {
    try {
      setLoading(true);
      const data = await journeysApi.getJourney(journeyId);
      setJourney(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load journey");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldSave = async (updates: Partial<JourneyResponse>) => {
    if (!journeyId || !journey) {
      return;
    }
    setSavePending(true);
    try {
      await journeysApi.updateJourney(journeyId, updates);
      await loadJourney();
      notify("Journey updated");
      setEditingName(false);
      setEditingDescription(false);
    } catch (error) {
      console.error("Save failed:", error);
      notify("Error saving");
      throw error;
    } finally {
      setSavePending(false);
    }
  };

  const startEditingName = () => {
    setNameValue(journey?.name || "");
    setEditingName(true);
  };

  const startEditingDescription = () => {
    setDescriptionValue(journey?.description || "");
    setEditingDescription(true);
  };

  const saveName = async () => {
    if (nameValue.trim() && nameValue !== journey?.name) {
      await handleFieldSave({ name: nameValue.trim() });
    } else {
      setEditingName(false);
    }
  };

  const saveDescription = async () => {
    if (descriptionValue !== journey?.description) {
      await handleFieldSave({ description: descriptionValue.trim() || undefined });
    } else {
      setEditingDescription(false);
    }
  };

  const handleAddPhase = () => {
    console.log("handleAddPhase called", { journey: !!journey, journeyId, phasesCount: journey?.phases?.length });
    if (!journey) {
      console.error("Cannot add phase: journey is not loaded");
      notify("Please wait for journey to load");
      return;
    }
    const nextOrder = journey.phases.length + 1;
    console.log("Setting phase form expanded to true, nextOrder:", nextOrder);
    setEditingPhaseId(null);
    setPhaseFormData({
      name: "",
      description: "",
      phase_order: nextOrder,
      expected_duration_min: undefined,
      expected_duration_max: undefined,
      duration_unit: "minutes",
      expected_emotion: undefined,
      emotion_intensity: undefined,
    });
    setMomentDrafts([]);
    setMomentsError(null);
    setError(null);
    setPhaseFormExpanded(true);
    window.requestAnimationFrame(() => {
      const container = timelineRef.current;
      if (container) {
        container.scrollTo({
          left: container.scrollWidth,
          behavior: "smooth",
        });
      }
    });
  };

  const handleGeneratePhaseWithAI = async () => {
    if (!journey) return;

    try {
      setAddingPhase(true);
      setError(null);
      setMomentsError(null);

      // Build existing phases summary with FULL details (not truncated)
      const sortedPhases = [...journey.phases].sort((a, b) => (a.phase_order || 0) - (b.phase_order || 0));
      const existingPhasesSummary = sortedPhases.length > 0
        ? sortedPhases
            .map((p) => {
              const emotionInfo = p.expected_emotion
                ? ` (Emotion: ${p.expected_emotion}${p.emotion_intensity ? `, Intensity: ${Math.round(p.emotion_intensity * 100)}%` : ""})`
                : "";
              const durationInfo =
                p.expected_duration_min && p.expected_duration_max
                  ? ` [Duration: ${p.expected_duration_min}-${p.expected_duration_max} ${p.duration_unit || "minutes"}]`
                  : "";
              // Include FULL description, not truncated
              const fullDescription = p.description || "No description";
              return `Phase ${p.phase_order || 0}: ${p.name}${emotionInfo}${durationInfo}\n   ${fullDescription}`;
            })
            .join("\n\n")
        : "No existing phases. This is the first phase of the journey.";

      // Get the last phase for explicit reference with FULL details
      const lastPhase = sortedPhases.length > 0 ? sortedPhases[sortedPhases.length - 1] : null;
      const lastPhaseSummary = lastPhase
        ? `LAST PHASE (Phase ${lastPhase.phase_order || sortedPhases.length}):\nName: ${lastPhase.name}\nDescription: ${lastPhase.description || "No description"}\nEmotion: ${lastPhase.expected_emotion || "not defined"}${lastPhase.emotion_intensity ? ` (${Math.round(lastPhase.emotion_intensity * 100)}%)` : ""}\nDuration: ${lastPhase.expected_duration_min || "?"}-${lastPhase.expected_duration_max || "?"} ${lastPhase.duration_unit || "minutes"}`
        : "No previous phase";

      // Build target group summary
      const targetGroupSummary = journey.target_group_id
        ? `Target Group ID: ${journey.target_group_id}`
        : "No target group defined";

      // Fetch and build persona summaries with actual data
      let personaSummaries = "No personas documented.";
      if (journey.target_group_id) {
        try {
          const personasResponse = await fetchTargetGroupPersonas(journey.target_group_id, "published", undefined, 1, 5);
          if (personasResponse.items && personasResponse.items.length > 0) {
            const personaDetails = await Promise.all(
              personasResponse.items.slice(0, 3).map(async (persona) => {
                try {
                  // Fetch full persona details
                  const response = await fetch(`/api/persona-admin/${persona.id}`, { cache: "no-store" });
                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                  }
                  const fullPersona = (await response.json()) as PersonaResponse;
                  const profile = fullPersona.profile;
                  const personaName = profile?.name || persona.name || "Unknown Persona";
                  const traits = profile?.traits ? Object.entries(profile.traits).map(([k, v]) => `${k}: ${v}`).slice(0, 5) : [];
                  const goals = profile?.goals ? profile.goals.map((g: any) => g.label || String(g)).slice(0, 3) : [];
                  const pains = profile?.pain_points ? profile.pain_points.map((p: any) => p.label || String(p)).slice(0, 3) : [];
                  
                  let summary = `- ${personaName}:`;
                  if (traits.length > 0) {
                    summary += ` Traits: ${traits.join(", ")}.`;
                  }
                  if (goals.length > 0) {
                    summary += ` Goals: ${goals.join(", ")}.`;
                  }
                  if (pains.length > 0) {
                    summary += ` Pain Points: ${pains.join(", ")}.`;
                  }
                  return summary;
                } catch (err) {
                  console.warn(`Failed to fetch persona ${persona.id}:`, err);
                  return `- ${persona.name || "Unknown"}: (Details not available)`;
                }
              })
            );
            personaSummaries = personaDetails.join("\n");
          }
        } catch (err) {
          console.warn("Failed to fetch personas:", err);
          personaSummaries = "Error loading personas.";
        }
      }

      const result = await runAiAssist({
        templateId: "journey.phase.create",
        journeyId,
        phaseContext: {
          journey_name: journey.name,
          journey_type: journey.journey_type || "unknown",
          journey_description: journey.description || "",
          target_group_summary: targetGroupSummary,
          persona_summaries: personaSummaries,
          existing_phases_summary: existingPhasesSummary,
          existing_phases_count: sortedPhases.length,
          next_phase_number: sortedPhases.length + 1, // Pre-calculate next phase number
          last_phase_summary: lastPhaseSummary,
          last_phase_name: lastPhase?.name || "",
          last_phase_emotion: lastPhase?.expected_emotion || "",
        },
      });

      // Parse the generated phase data
      // Try to extract JSON from the response (might be wrapped in markdown or text)
      let parsed: any = null;
      
      if (result.rawOutput) {
        try {
          // First, try to parse directly
          parsed = JSON.parse(result.rawOutput);
        } catch {
          // If that fails, try to extract JSON from markdown code blocks
          const jsonMatch = result.rawOutput.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[1]);
            } catch {
              // Try to find JSON object in the text
              const jsonObjectMatch = result.rawOutput.match(/\{[\s\S]*\}/);
              if (jsonObjectMatch) {
                try {
                  parsed = JSON.parse(jsonObjectMatch[0]);
                } catch (e) {
                  console.error("Failed to parse JSON from response:", e);
                }
              }
            }
          } else {
            // Try to find JSON object directly in the text
            const jsonObjectMatch = result.rawOutput.match(/\{[\s\S]*\}/);
            if (jsonObjectMatch) {
              try {
                parsed = JSON.parse(jsonObjectMatch[0]);
              } catch (e) {
                console.error("Failed to parse JSON from response:", e);
              }
            }
          }
        }
      }

      if (parsed) {
        const nextOrder = journey.phases.length + 1;

        setPhaseFormData({
          name: parsed.name || "",
          description: parsed.description || "",
          phase_order: nextOrder,
          expected_duration_min: parsed.expected_duration_min,
          expected_duration_max: parsed.expected_duration_max,
          duration_unit: parsed.duration_unit || "minutes",
          // Limit expected_emotion to 64 characters (database constraint)
          expected_emotion: parsed.expected_emotion ? parsed.expected_emotion.substring(0, 64) : undefined,
          emotion_intensity: parsed.emotion_intensity,
        });
        setMomentDrafts([]);
        setPhaseFormExpanded(true);
        notify("Phase generated with AI");
        
        window.requestAnimationFrame(() => {
          const container = timelineRef.current;
          if (container) {
            container.scrollTo({
              left: container.scrollWidth,
              behavior: "smooth",
            });
          }
        });
      } else if (result.suggestions && result.suggestions.length > 0) {
        // Fallback: use first suggestion if rawOutput is not available
        const suggestion = result.suggestions[0];
        const nextOrder = journey.phases.length + 1;
        setPhaseFormData({
          name: suggestion.title || suggestion.content || "",
          description: suggestion.content || "",
          phase_order: nextOrder,
          expected_duration_min: undefined,
          expected_duration_max: undefined,
          duration_unit: "minutes",
          expected_emotion: suggestion.type || undefined,
          emotion_intensity: undefined,
        });
        setMomentDrafts([]);
        setPhaseFormExpanded(true);
        notify("Phase generated with AI");
      } else {
        setError("AI konnte keine Phase generieren. Bitte versuche es erneut.");
        notify("AI generation failed");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate phase with AI";
      setError(errorMessage);
      setMomentsError(errorMessage);
      notify(errorMessage);
    } finally {
      setAddingPhase(false);
    }
  };

  const handleDeletePhase = async (phaseId: string) => {
    if (!journey) return;

    try {
      await journeysApi.deletePhase(journeyId, phaseId);
      await loadJourney();
      notify("Phase deleted");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete phase";
      notify(errorMessage);
      throw err;
    }
  };

  const handleSavePhase = async (phaseId: string, data: Partial<JourneyResponse["phases"][number]>) => {
    if (!journey) return;

    try {
      // Update phase data
      const phaseUpdate: Partial<PhaseCreate> = {
        name: data.name,
        description: data.description,
        phase_order: data.phase_order,
        expected_duration_min: data.expected_duration_min,
        expected_duration_max: data.expected_duration_max,
        duration_unit: data.duration_unit,
        // Limit expected_emotion to 64 characters (database constraint)
        expected_emotion: data.expected_emotion ? data.expected_emotion.substring(0, 64) : undefined,
        emotion_intensity: data.emotion_intensity,
      };
      await journeysApi.updatePhase(journeyId, phaseId, phaseUpdate);

      // Handle elements if provided
      if (data.elements && Array.isArray(data.elements)) {
        const currentPhase = journey.phases.find((p) => p.id === phaseId);
        const existingElementIds = new Set((currentPhase?.elements || []).map((e) => e.id));
        const draftIds = new Set(
          data.elements
            .filter((e: any) => e.id && typeof e.id === "string" && e.id.startsWith("element-"))
            .map((e: any) => e.id.replace("element-", ""))
        );

        // Delete elements that are no longer in drafts
        for (const element of currentPhase?.elements || []) {
          if (!draftIds.has(element.id)) {
            await journeysApi.deleteElement(journeyId, phaseId, element.id);
          }
        }

        // Update or create elements
        const validElements = data.elements.filter((e: any) => e.content?.trim());
        for (const [index, element] of validElements.entries()) {
          if (element.id && typeof element.id === "string" && element.id.startsWith("element-")) {
            // Update existing element
            const elementId = element.id.replace("element-", "");
            await journeysApi.updateElement(journeyId, phaseId, elementId, {
              element_type: element.element_type,
              content: element.content.trim(),
              element_order: index + 1,
            });
          } else {
            // Create new element
            await journeysApi.createElement(journeyId, phaseId, {
              element_type: element.element_type,
              content: element.content.trim(),
              element_order: index + 1,
            });
          }
        }
      }

      await loadJourney();
      notify("Phase updated");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update phase";
      notify(errorMessage);
      throw err;
    }
  };

  const newMomentId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);

  const addMomentDraft = () => {
    setMomentDrafts((prev) => [
      ...prev,
      {
        id: newMomentId(),
        element_type: "action",
        content: "",
      },
    ]);
  };

  const updateMomentDraft = (id: string, updates: Partial<JourneyMomentDraft>) => {
    setMomentDrafts((prev) => prev.map((moment) => (moment.id === id ? { ...moment, ...updates } : moment)));
  };

  const removeMomentDraft = (id: string) => {
    setMomentDrafts((prev) => prev.filter((moment) => moment.id !== id));
  };

  const triggerMomentGeneration = async () => {
    if (!journey) {
      setMomentsError("Journey data is not loaded yet.");
      return;
    }
    if (!phaseFormData.name.trim() && !phaseFormData.description?.trim()) {
      setMomentsError("Bitte gib mindestens einen Namen oder eine Beschreibung für die Phase ein.");
      return;
    }
    setMomentsError(null);
    try {
      const result = await runAiAssist({
        templateId: "journey.moments",
        journeyId,
        phaseContext: {
          name: phaseFormData.name,
          description: phaseFormData.description,
          expected_emotion: phaseFormData.expected_emotion,
        },
        maxSuggestions: 4,
      });
      if (!result.suggestions.length) {
        setMomentsError("Keine Journey Moments generiert. Bitte beschreibe die Phase detaillierter und versuche es erneut.");
        return;
      }
      const normalized = result.suggestions.map((suggestion) => ({
        id: newMomentId(),
        element_type: (suggestion.type as JourneyElementType) || "action",
        content: suggestion.content.trim(),
      }));
      setMomentDrafts(normalized);
    } catch (err) {
      setMomentsError(err instanceof Error ? err.message : "AI konnte keine Journey Moments generieren.");
    }
  };

  const scrollToPhase = (index: number) => {
    const container = timelineRef.current;
    if (!container) return;
    const clampedIndex = Math.max(0, Math.min(index, journey?.phases.length ? journey.phases.length - 1 : 0));
    const target = container.querySelector<HTMLElement>(`[data-phase-index="${clampedIndex}"]`);
    if (!target) return;
    const offset = target.offsetLeft - container.offsetLeft;
    container.scrollTo({
      left: offset,
      behavior: "smooth",
    });
    setActivePhaseIndex(clampedIndex);
  };

  const handleTimelineScroll = useCallback(() => {
    const container = timelineRef.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-phase-index]"));
    if (!cards.length) {
      setActivePhaseIndex(0);
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    let closestIndex = 0;
    let minDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distance = Math.abs(cardCenter - containerCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = Number(card.dataset.phaseIndex || 0);
      }
    });
    setActivePhaseIndex(closestIndex);
  }, []);

  const scrollRelative = (direction: -1 | 1) => {
    if (!journey?.phases.length) return;
    const nextIndex = Math.max(0, Math.min(journey.phases.length - 1, activePhaseIndex + direction));
    scrollToPhase(nextIndex);
  };

  const handleTimelineKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollRelative(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollRelative(-1);
    }
  };

  useEffect(() => {
    handleTimelineScroll();
  }, [journey?.phases.length, handleTimelineScroll]);

  useEffect(() => {
    window.addEventListener("resize", handleTimelineScroll);
    return () => {
      window.removeEventListener("resize", handleTimelineScroll);
    };
  }, [handleTimelineScroll]);

  const handleSubmitPhase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journey) return;

    try {
      setAddingPhase(true);
      setError(null);
      
      if (!phaseFormData.name.trim()) {
        throw new Error("Phase name is required");
      }

      if (editingPhaseId) {
        // Update existing phase
        await journeysApi.updatePhase(journeyId, editingPhaseId, phaseFormData);
        
        // Get current phase elements to compare
        const currentPhase = journey.phases.find((p) => p.id === editingPhaseId);
        const existingElementIds = new Set((currentPhase?.elements || []).map((e) => e.id));
        const draftIds = new Set(momentDrafts.filter((m) => m.id && m.id.startsWith("element-")).map((m) => m.id.replace("element-", "")));
        
        // Delete elements that are no longer in drafts
        for (const element of currentPhase?.elements || []) {
          if (!draftIds.has(element.id)) {
            await journeysApi.deleteElement(journeyId, editingPhaseId, element.id);
          }
        }
        
        // Update or create elements
        const validMoments = momentDrafts.filter((moment) => moment.content.trim());
        for (const [index, moment] of validMoments.entries()) {
          if (moment.id && moment.id.startsWith("element-")) {
            // Update existing element
            const elementId = moment.id.replace("element-", "");
            await journeysApi.updateElement(journeyId, editingPhaseId, elementId, {
              element_type: moment.element_type,
              content: moment.content.trim(),
              element_order: index + 1,
            });
          } else {
            // Create new element
            await journeysApi.createElement(journeyId, editingPhaseId, {
              element_type: moment.element_type,
              content: moment.content.trim(),
              element_order: index + 1,
            });
          }
        }
        
        notify("Phase updated");
      } else {
        // Create new phase
        const createdPhase = await journeysApi.createPhase(journeyId, phaseFormData);
        if (momentDrafts.length) {
          const validMoments = momentDrafts.filter((moment) => moment.content.trim());
          for (const [index, moment] of validMoments.entries()) {
            await journeysApi.createElement(journeyId, createdPhase.id, {
              element_type: moment.element_type,
              content: moment.content.trim(),
              element_order: index + 1,
            });
          }
        }
        notify("Phase added");
      }
      
      setPhaseFormExpanded(false);
      setEditingPhaseId(null);
      setPhaseFormData({
        name: "",
        description: "",
        phase_order: journey.phases.length + 2,
        expected_duration_min: undefined,
        expected_duration_max: undefined,
        duration_unit: "minutes",
        expected_emotion: undefined,
        emotion_intensity: undefined,
      });
      setMomentDrafts([]);
      setMomentsError(null);
      await loadJourney();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save phase";
      setError(errorMessage);
      notify(errorMessage);
    } finally {
      setAddingPhase(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <MsqdxIcon name="hourglass_empty" customSize={24} />
        <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>Loading journey...</MsqdxTypography>
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div style={{ padding: "2rem" }}>
        <MsqdxTypography variant="body2" sx={{ color: "error.main" }}>{error || "Journey not found"}</MsqdxTypography>
      </div>
    );
  }

  return (
    <div className="msqdx-glass-panel">
      <div className="msqdx-glass-detail">
        <MsqdxCard
          variant="flat"
          brandColor={BRAND_COLOR}
          borderRadius="md"
          component="header"
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            flexWrap: "wrap",
            backgroundColor: "background.paper",
            "& > div": { padding: "8px", gap: "8px", display: "flex", flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "row", gap: "8px", flex: 1, minWidth: 0, flexWrap: "wrap", alignItems: "center" }}>
            {editingName ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <MsqdxFormField
                  label=""
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveName();
                    } else if (e.key === "Escape") {
                      setEditingName(false);
                      setNameValue(journey?.name || "");
                    }
                  }}
                  disabled={savePending}
                  fullWidth
                  size="small"
                  borderColor={BRAND_COLOR}
                  sx={{ "& .MuiInputBase-input": { fontSize: "1.25rem", fontWeight: 600 } }}
                />
                <MsqdxButton variant="text" size="small" onClick={saveName} disabled={savePending} sx={{ minWidth: 28, minHeight: 28, p: 0 }} aria-label="Save name">
                  <MsqdxIcon name="check" customSize={16} />
                </MsqdxButton>
                <MsqdxButton variant="text" size="small" onClick={() => { setEditingName(false); setNameValue(journey?.name || ""); }} disabled={savePending} sx={{ minWidth: 28, minHeight: 28, p: 0 }} aria-label="Cancel">
                  <MsqdxIcon name="close" customSize={16} />
                </MsqdxButton>
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <MsqdxTypography variant="h5" weight="semibold" sx={{ flex: 1 }}>{journey.name}</MsqdxTypography>
                <MsqdxButton variant="text" size="small" onClick={startEditingName} disabled={savePending} sx={{ minWidth: 28, minHeight: 28, p: 0 }} aria-label="Edit name">
                  <MsqdxIcon name="edit" customSize={16} />
                </MsqdxButton>
              </Box>
            )}
            {editingDescription ? (
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <MsqdxTextareaField
                  label=""
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  onBlur={saveDescription}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditingDescription(false);
                      setDescriptionValue(journey?.description || "");
                    }
                  }}
                  disabled={savePending}
                  fullWidth
                  minRows={2}
                  borderColor={BRAND_COLOR}
                />
                <MsqdxButton variant="text" size="small" onClick={saveDescription} disabled={savePending} sx={{ minWidth: 28, minHeight: 28, p: 0 }} aria-label="Save description">
                  <MsqdxIcon name="check" customSize={16} />
                </MsqdxButton>
                <MsqdxButton variant="text" size="small" onClick={() => { setEditingDescription(false); setDescriptionValue(journey?.description || ""); }} disabled={savePending} sx={{ minWidth: 28, minHeight: 28, p: 0 }} aria-label="Cancel">
                  <MsqdxIcon name="close" customSize={16} />
                </MsqdxButton>
              </Box>
            ) : (
              journey.description ? (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <MsqdxTypography variant="body2" sx={{ color: "text.secondary", flex: 1 }}>{journey.description}</MsqdxTypography>
                  <MsqdxButton variant="text" size="small" onClick={startEditingDescription} disabled={savePending} sx={{ minWidth: 28, minHeight: 28, p: 0 }} aria-label="Edit description">
                    <MsqdxIcon name="edit" customSize={14} />
                  </MsqdxButton>
                </Box>
              ) : (
                <MsqdxButton variant="text" size="small" onClick={startEditingDescription} disabled={savePending} sx={{ alignSelf: "flex-start", color: "text.secondary" }}>
                  <MsqdxIcon name="add" customSize={14} /> Add description
                </MsqdxButton>
              )
            )}
          </Box>
          <Box sx={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <MsqdxButton variant="outlined" size="small" onClick={() => router.push(`/admin/journeys/${journeyId}/dashboard`)} startIcon={<MsqdxIcon name="dashboard" customSize={14} />}>
              Dashboard
            </MsqdxButton>
            <MsqdxButton variant="outlined" size="small" onClick={() => router.push("/admin/journeys")} startIcon={<MsqdxIcon name="arrow_back" customSize={14} />}>
              Back
            </MsqdxButton>
          </Box>
        </MsqdxCard>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 2, mt: 2 }}>
          <Box sx={{ gridColumn: "1 / -1" }}>
            <MsqdxDashboardCard
              id="metadata"
              title="Metadaten"
              icon="info"
              size="small"
              brandColor={BRAND_COLOR}
              iconColor={{ color: "var(--color-theme-accent)" }}
              expanded={isAccordionExpanded("metadata")}
              onToggle={toggleAccordion}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: "8px",
                  pt: 0,
                }}
              >
                <Box>
                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                    Type
                  </MsqdxTypography>
                  <MsqdxTypography variant="body2" weight="medium">{journey.journey_type}</MsqdxTypography>
                </Box>
                <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1 }}>
                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                    Creation Mode
                  </MsqdxTypography>
                  <MsqdxTypography variant="body2" weight="medium">{journey.creation_mode}</MsqdxTypography>
                </Box>
                <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1 }}>
                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                    Status
                  </MsqdxTypography>
                  <MsqdxTypography variant="body2" weight="medium">{journey.status}</MsqdxTypography>
                </Box>
                {typeof journey.validation_score === "number" && (
                  <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1 }}>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                      Validation Score
                    </MsqdxTypography>
                    <MsqdxTypography variant="body2" weight="medium">{journey.validation_score.toFixed(1)}%</MsqdxTypography>
                  </Box>
                )}
                <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1 }}>
                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                    Tracking
                  </MsqdxTypography>
                  <MsqdxTypography variant="body2" weight="medium">{journey.tracking_enabled ? "Enabled" : "Disabled"}</MsqdxTypography>
                </Box>
                <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1 }}>
                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                    Created
                  </MsqdxTypography>
                  <MsqdxTypography variant="body2" weight="medium">{formatDate(journey.created_at)}</MsqdxTypography>
                </Box>
                <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 1 }}>
                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}>
                    Updated
                  </MsqdxTypography>
                  <MsqdxTypography variant="body2" weight="medium">{formatDate(journey.updated_at)}</MsqdxTypography>
                </Box>
              </Box>
            </MsqdxDashboardCard>
          </Box>
        </Box>

        <div className="msqdx-glass-detail__section">
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}>
            <MsqdxTypography variant="h5" weight="semibold">
              Phases <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>({journey.phases.length})</Box>
            </MsqdxTypography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {journey.phases.length > 0 && (
                <Box role="group" aria-label="Timeline navigation" sx={{ display: "flex", gap: "8px" }}>
                  <MsqdxButton
                    variant="outlined"
                    size="small"
                    onClick={() => scrollRelative(-1)}
                    disabled={activePhaseIndex === 0}
                    aria-label="Scroll to previous phase"
                  >
                    <MsqdxIcon name="chevron_left" customSize={18} />
                  </MsqdxButton>
                  <MsqdxButton
                    variant="outlined"
                    size="small"
                    onClick={() => scrollRelative(1)}
                    disabled={journey.phases.length === 0 || activePhaseIndex === journey.phases.length - 1}
                    aria-label="Scroll to next phase"
                  >
                    <MsqdxIcon name="chevron_right" customSize={18} />
                  </MsqdxButton>
                </Box>
              )}
              <MsqdxButton
                variant="outlined"
                size="small"
                onClick={handleAddPhase}
                disabled={addingPhase}
                startIcon={<MsqdxIcon name="add" customSize={16} />}
              >
                New Phase
              </MsqdxButton>
            </Box>
          </Box>
          
          {journey.phases.length === 0 && !phaseFormExpanded ? (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              No phases yet. Add your first phase to get started.
            </MsqdxTypography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
              <Box
                role="tablist"
                aria-label="Journey phase steps"
                sx={{
                  display: "flex",
                  gap: 0.5,
                  overflowX: "auto",
                  pb: 0.5,
                  "&::-webkit-scrollbar": { height: 6 },
                  "&::-webkit-scrollbar-thumb": {
                    backgroundColor: "action.disabled",
                    borderRadius: 3,
                    "&:hover": { backgroundColor: "action.active" },
                  },
                }}
              >
                {journey.phases.map((phase, index) => (
                  <MsqdxButton
                    key={phase.id}
                    variant={index === activePhaseIndex ? "contained" : "outlined"}
                    size="small"
                    onClick={() => scrollToPhase(index)}
                    aria-current={index === activePhaseIndex ? "step" : undefined}
                    aria-label={`Phase ${index + 1}: ${phase.name}`}
                    sx={{
                      flexShrink: 0,
                      minWidth: 80,
                      justifyContent: "flex-start",
                      gap: 0.5,
                    }}
                  >
                    <Box component="span" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>{index + 1}</Box>
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{phase.name}</Box>
                  </MsqdxButton>
                ))}
                <MsqdxButton
                  variant="outlined"
                  size="small"
                  onClick={handleAddPhase}
                  disabled={addingPhase}
                  startIcon={<MsqdxIcon name="add" customSize={16} />}
                  sx={{ flexShrink: 0 }}
                >
                  Phase hinzufügen
                </MsqdxButton>
              </Box>
              <Box
                ref={timelineRef}
                onScroll={handleTimelineScroll}
                tabIndex={0}
                onKeyDown={handleTimelineKeyDown}
                aria-label="Journey phases timeline"
                sx={{
                  flex: 1,
                  overflowX: "auto",
                  overflowY: "hidden",
                  display: "flex",
                  gap: 2,
                  p: 2,
                  pb: 3,
                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                  "&::-webkit-scrollbar": { height: 8 },
                  "&::-webkit-scrollbar-thumb": {
                    backgroundColor: "action.disabled",
                    borderRadius: 4,
                    "&:hover": { backgroundColor: "action.active" },
                  },
                }}
              >
                {journey.phases.map((phase, index) => (
                  <MsqdxGlassJourneyPhaseCard
                    key={phase.id}
                    phase={phase}
                    index={index}
                    isActive={index === activePhaseIndex}
                    journeyId={journeyId}
                    journey={{
                      name: journey.name,
                      journey_type: journey.journey_type,
                      description: journey.description,
                      target_group_id: journey.target_group_id,
                    }}
                    onSave={handleSavePhase}
                    onDelete={handleDeletePhase}
                  />
                ))}
                {phaseFormExpanded ? (
                  <MsqdxCard variant="flat" brandColor={BRAND_COLOR} borderRadius="button" sx={{ minWidth: 380, p: 2 }}>
                    <Box component="form" onSubmit={handleSubmitPhase} aria-label="Create new phase" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                        <Box sx={{ width: 32, height: 32, borderRadius: "full", bgcolor: "primary.main", color: "primary.contrastText", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.875rem", fontWeight: 700 }}>
                          {editingPhaseId ? journey.phases.findIndex((p) => p.id === editingPhaseId) + 1 : journey.phases.length + 1}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>{editingPhaseId ? "Edit Phase" : "New Phase"}</MsqdxTypography>
                          <MsqdxTypography variant="h6" weight="semibold">{editingPhaseId ? "Update phase details" : "Define the next step"}</MsqdxTypography>
                        </Box>
                        {editingPhaseId && (
                          <MsqdxButton variant="text" size="small" onClick={() => { setPhaseFormExpanded(false); setEditingPhaseId(null); setPhaseFormData({ name: "", description: "", phase_order: journey.phases.length + 1, expected_duration_min: undefined, expected_duration_max: undefined, duration_unit: "minutes", expected_emotion: undefined, emotion_intensity: undefined }); setMomentDrafts([]); setMomentsError(null); setError(null); }} disabled={addingPhase} aria-label="Cancel editing"><MsqdxIcon name="close" customSize={18} /></MsqdxButton>
                        )}
                      </Box>
                      {error && <MsqdxTypography variant="body2" color="error">Error: {error}</MsqdxTypography>}
                      <MsqdxFormField label="Name *" value={phaseFormData.name} onChange={(e) => setPhaseFormData({ ...phaseFormData, name: e.target.value })} placeholder="e.g., Awareness, Consideration" required disabled={addingPhase} fullWidth size="small" borderColor={BRAND_COLOR} />
                      <MsqdxTextareaField label="Description" value={phaseFormData.description} onChange={(e) => setPhaseFormData({ ...phaseFormData, description: e.target.value })} placeholder="Describe the goal, mindset or tasks in this phase." minRows={3} disabled={addingPhase} fullWidth borderColor={BRAND_COLOR} />
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
                        <MsqdxFormField label="Duration Min" value={String(phaseFormData.expected_duration_min ?? "")} onChange={(e) => setPhaseFormData({ ...phaseFormData, expected_duration_min: e.target.value ? parseInt(e.target.value) : undefined })} type="number" disabled={addingPhase} size="small" borderColor={BRAND_COLOR} />
                        <MsqdxFormField label="Duration Max" value={String(phaseFormData.expected_duration_max ?? "")} onChange={(e) => setPhaseFormData({ ...phaseFormData, expected_duration_max: e.target.value ? parseInt(e.target.value) : undefined })} type="number" disabled={addingPhase} size="small" borderColor={BRAND_COLOR} />
                        <MsqdxSelect label="Unit" value={phaseFormData.duration_unit} onChange={(e: any) => setPhaseFormData({ ...phaseFormData, duration_unit: e.target.value })} options={[{ value: "minutes", label: "Minutes" }, { value: "hours", label: "Hours" }, { value: "days", label: "Days" }]} disabled={addingPhase} size="small" borderColor={BRAND_COLOR} />
                      </Box>
                      <MsqdxFormField label="Expected Emotion" value={phaseFormData.expected_emotion ?? ""} onChange={(e) => setPhaseFormData({ ...phaseFormData, expected_emotion: e.target.value || undefined })} placeholder="e.g., excited, anxious" disabled={addingPhase} size="small" fullWidth borderColor={BRAND_COLOR} />
                      <Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                          <Box>
                            <MsqdxTypography variant="caption" weight="semibold">Journey Moments</MsqdxTypography>
                            <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Erfasse zentrale Aktionen, Gedanken oder Touchpoints dieser Phase.</MsqdxTypography>
                          </Box>
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            <MsqdxGlassAiButton templates={[{ id: "journey.moments", label: "AI Vorschlag", maxSuggestions: 4 }]} onClick={triggerMomentGeneration} disabled={!journey || addingPhase || aiAssistLoading} loading={aiAssistLoading} size="small" title="AI Vorschlag" />
                            <MsqdxButton variant="outlined" size="small" onClick={addMomentDraft} disabled={addingPhase} startIcon={<MsqdxIcon name="add_circle" customSize={14} />}>Moment hinzufügen</MsqdxButton>
                          </Box>
                        </Box>
                        {momentsError && <MsqdxTypography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>Hinweis: {momentsError}</MsqdxTypography>}
                        {momentDrafts.length === 0 ? (
                          <MsqdxTypography variant="body2" sx={{ color: "text.secondary", py: 2 }}>Keine Journey Moments hinzugefügt.</MsqdxTypography>
                        ) : (
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                            {momentDrafts.map((moment) => (
                              <Box key={moment.id} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                                <Box sx={{ width: 140, flexShrink: 0 }}>
                                  <MsqdxSelect label="Type" value={moment.element_type} onChange={(e: any) => updateMomentDraft(moment.id, { element_type: e.target.value })} options={ELEMENT_TYPE_OPTIONS.map((opt) => ({ value: opt, label: opt.replace("_", " ") }))} disabled={addingPhase} size="small" borderColor={BRAND_COLOR} />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                  <MsqdxTextareaField label="Beschreibung" value={moment.content} onChange={(e) => updateMomentDraft(moment.id, { content: e.target.value })} placeholder="Beschreibe den Touchpoint oder Gedanken..." minRows={2} disabled={addingPhase} fullWidth borderColor={BRAND_COLOR} />
                                </Box>
                                <MsqdxButton variant="text" size="small" onClick={() => removeMomentDraft(moment.id)} disabled={addingPhase} aria-label="Moment entfernen" sx={{ alignSelf: "flex-start", mt: 2 }}><MsqdxIcon name="close" customSize={14} /></MsqdxButton>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", pt: 1 }}>
                        <MsqdxButton variant="text" size="small" onClick={() => { setPhaseFormExpanded(false); setEditingPhaseId(null); setMomentDrafts([]); setMomentsError(null); setError(null); setPhaseFormData({ name: "", description: "", phase_order: journey.phases.length + 1, expected_duration_min: undefined, expected_duration_max: undefined, duration_unit: "minutes", expected_emotion: undefined, emotion_intensity: undefined }); }} disabled={addingPhase}>Cancel</MsqdxButton>
                        <MsqdxButton type="submit" variant="contained" size="small" brandColor="green" disabled={addingPhase || !phaseFormData.name.trim()} startIcon={<MsqdxIcon name={addingPhase ? "hourglass_empty" : editingPhaseId ? "save" : "add"} customSize={14} />}>{addingPhase ? (editingPhaseId ? "Updating..." : "Adding...") : (editingPhaseId ? "Update Phase" : "Add Phase")}</MsqdxButton>
                      </Box>
                    </Box>
                  </MsqdxCard>
                ) : (
                  <MsqdxCard
                    variant="flat"
                    sx={{
                      minWidth: 380,
                      p: 3,
                      position: "relative",
                      borderStyle: "dashed",
                      opacity: addingPhase || aiAssistLoading ? 0.6 : 1,
                      cursor: addingPhase || aiAssistLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      onClick={handleAddPhase}
                      disabled={addingPhase || aiAssistLoading}
                      aria-label="Add a new phase"
                      sx={{
                        width: "100%",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: addingPhase || aiAssistLoading ? "not-allowed" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: "full", bgcolor: "action.hover", mb: 1.5 }}>
                        <MsqdxIcon name="add" customSize={28} />
                      </Box>
                      <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 0.5 }}>Add phase</MsqdxTypography>
                      <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                        Extend the journey with another touchpoint, task or feeling.
                      </MsqdxTypography>
                    </Box>
                    <Box sx={{ position: "absolute", bottom: 16, right: 16 }} onClick={(e) => e.stopPropagation()}>
                      <MsqdxGlassAiButton
                        templates={[{ id: "journey.phase.create", label: "AI Generate Phase", maxSuggestions: 1 }]}
                        onClick={handleGeneratePhaseWithAI}
                        disabled={!journey || addingPhase || aiAssistLoading}
                        loading={aiAssistLoading}
                        size="small"
                        title="Generate phase with AI"
                      />
                    </Box>
                  </MsqdxCard>
                )}
              </Box>
              <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }} component="div" aria-live="polite">
                Phase {activePhaseIndex + 1} of {journey.phases.length}
              </MsqdxTypography>
            </Box>
          )}
        </div>
      </div>
    </div>
  );
}
