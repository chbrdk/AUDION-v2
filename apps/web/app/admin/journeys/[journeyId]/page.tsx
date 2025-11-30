"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useParams } from "next/navigation";
import {
  journeysApi,
  type JourneyAiGenerateRequest,
  type JourneyResponse,
  type PhaseCreate,
} from "../../../api/_lib/journeys";
import { fetchTargetGroupPersonas, type PersonaResponse } from "../../../api/_lib/target-group";
import { MaterialSymbol } from "../../../../components/material-symbol";
import { UdgGlassJourneyPhaseCard } from "../../../../components/journeys/udg-glass-phase-card";
import { UdgGlassAiButton } from "../../../../components/ai/udg-glass-ai-button";
import { useAiAssist } from "../../../../hooks/use-ai-assist";
import clsx from "clsx";

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

  const existingToasts = document.querySelectorAll(".udg-glass-toast");
  existingToasts.forEach((toast) => (toast as any).remove());

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

export default function JourneyEditorPage() {
  const params = useParams();
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
  const { execute: runAiAssist, loading: aiAssistLoading } = useAiAssist();

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
    const nextOrder = journey ? journey.phases.length + 1 : 1;
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
                  const personaName = fullPersona.name || persona.name || "Unknown Persona";
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
        <MaterialSymbol icon="hourglass_empty" fontSize={24} />
        <p className="udg-glass-muted">Loading journey...</p>
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div style={{ padding: "2rem" }}>
        <p className="udg-glass-error">{error || "Journey not found"}</p>
      </div>
    );
  }

  return (
    <div className="udg-glass-panel">
      <div className="udg-glass-detail">
        <header className="udg-glass-detail__header">
          <div className="udg-glass-detail__title">
            {editingName ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="text"
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
                  autoFocus
                  disabled={savePending}
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 600,
                    border: "1px solid var(--color-theme-accent)",
                    borderRadius: "4px",
                    padding: "0.5rem",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    flex: 1,
                  }}
                />
                <button
                  className="udg-glass-button --ghost"
                  onClick={saveName}
                  disabled={savePending}
                  style={{ padding: "0.25rem 0.5rem" }}
                >
                  <MaterialSymbol icon="check" fontSize={16} />
                </button>
                <button
                  className="udg-glass-button --ghost"
                  onClick={() => {
                    setEditingName(false);
                    setNameValue(journey?.name || "");
                  }}
                  disabled={savePending}
                  style={{ padding: "0.25rem 0.5rem" }}
                >
                  <MaterialSymbol icon="close" fontSize={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>{journey.name}</h1>
                <button
                  className="udg-glass-button --ghost"
                  onClick={startEditingName}
                  disabled={savePending}
                  style={{ padding: "0.25rem 0.5rem" }}
                  title="Edit name"
                >
                  <MaterialSymbol icon="edit" fontSize={16} />
                </button>
              </div>
            )}
            {editingDescription ? (
              <div style={{ display: "flex", alignItems: "start", gap: "0.5rem", marginTop: "0.5rem" }}>
                <textarea
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  onBlur={saveDescription}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditingDescription(false);
                      setDescriptionValue(journey?.description || "");
                    }
                  }}
                  autoFocus
                  disabled={savePending}
                  rows={2}
                  style={{
                    fontSize: "0.875rem",
                    border: "1px solid var(--color-theme-accent)",
                    borderRadius: "4px",
                    padding: "0.5rem",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-secondary)",
                    flex: 1,
                    fontFamily: "inherit",
                  }}
                />
                <button
                  className="udg-glass-button --ghost"
                  onClick={saveDescription}
                  disabled={savePending}
                  style={{ padding: "0.25rem 0.5rem" }}
                >
                  <MaterialSymbol icon="check" fontSize={16} />
                </button>
                <button
                  className="udg-glass-button --ghost"
                  onClick={() => {
                    setEditingDescription(false);
                    setDescriptionValue(journey?.description || "");
                  }}
                  disabled={savePending}
                  style={{ padding: "0.25rem 0.5rem" }}
                >
                  <MaterialSymbol icon="close" fontSize={16} />
                </button>
              </div>
            ) : (
              journey.description ? (
                <div style={{ display: "flex", alignItems: "start", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", margin: 0 }}>{journey.description}</p>
                  <button
                    className="udg-glass-button --ghost"
                    onClick={startEditingDescription}
                    disabled={savePending}
                    style={{ padding: "0.25rem 0.5rem" }}
                    title="Edit description"
                  >
                    <MaterialSymbol icon="edit" fontSize={14} />
                  </button>
                </div>
              ) : (
                <button
                  className="udg-glass-button --ghost"
                  onClick={startEditingDescription}
                  disabled={savePending}
                  style={{ padding: "0.25rem 0.5rem", marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}
                >
                  <MaterialSymbol icon="add" fontSize={14} /> Add description
                </button>
              )
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              className="udg-glass-button --ghost"
              onClick={() => {
                window.location.href = `/admin/journeys/${journeyId}/dashboard`;
              }}
              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
            >
              <MaterialSymbol icon="dashboard" fontSize={14} /> Dashboard
            </button>
            <button
              className="udg-glass-button --ghost"
              onClick={() => {
                window.location.href = "/admin/journeys";
              }}
              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
            >
              <MaterialSymbol icon="arrow_back" fontSize={14} /> Back
            </button>
          </div>
        </header>

        <div className="udg-glass-detail__grid">
          <div style={{ border: "1px solid var(--color-theme-accent)", borderRadius: "12px", padding: "0.75rem", marginTop: "1rem" }}>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 100, marginBottom: "2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Metadaten</h3>
            <dl className="udg-glass-meta-grid">
              <div>
                <dt>Type</dt>
                <dd>{journey.journey_type}</dd>
              </div>
              <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
                <dt>Creation Mode</dt>
                <dd>{journey.creation_mode}</dd>
              </div>
              <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
                <dt>Status</dt>
                <dd>{journey.status}</dd>
              </div>
              {typeof journey.validation_score === "number" && (
                <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
                  <dt>Validation Score</dt>
                  <dd>{journey.validation_score.toFixed(1)}%</dd>
                </div>
              )}
              <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
                <dt>Tracking</dt>
                <dd>{journey.tracking_enabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
                <dt>Created</dt>
                <dd>{formatDate(journey.created_at)}</dd>
              </div>
              <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
                <dt>Updated</dt>
                <dd>{formatDate(journey.updated_at)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="udg-glass-detail__section">
          <div className="udg-glass-journey-timeline__header">
            <h3>
              Phases <span className="udg-glass-journey-timeline__count">({journey.phases.length})</span>
            </h3>
            <div className="udg-glass-journey-timeline__actions">
              {journey.phases.length > 0 && (
                <div className="udg-glass-journey-timeline__control-group" role="group" aria-label="Timeline navigation">
                  <button
                    type="button"
                    className="udg-glass-button --ghost"
                    onClick={() => scrollRelative(-1)}
                    disabled={activePhaseIndex === 0}
                    aria-label="Scroll to previous phase"
                  >
                    <MaterialSymbol icon="chevron_left" fontSize={18} />
                  </button>
                  <button
                    type="button"
                    className="udg-glass-button --ghost"
                    onClick={() => scrollRelative(1)}
                    disabled={journey.phases.length === 0 || activePhaseIndex === journey.phases.length - 1}
                    aria-label="Scroll to next phase"
                  >
                    <MaterialSymbol icon="chevron_right" fontSize={18} />
                  </button>
                </div>
              )}
              <button
                className="udg-glass-button --ghost"
                type="button"
                onClick={handleAddPhase}
                disabled={addingPhase}
              >
                <MaterialSymbol icon="add" fontSize={16} /> New Phase
              </button>
            </div>
          </div>
          
          {journey.phases.length === 0 ? (
            <p className="udg-glass-empty">No phases yet. Add your first phase to get started.</p>
          ) : (
            <div className="udg-glass-journey-timeline">
              <div className="udg-glass-journey-timeline__steps" role="tablist" aria-label="Journey phase steps">
                {journey.phases.map((phase, index) => (
                  <button
                    type="button"
                    key={phase.id}
                    className={clsx("udg-glass-journey-timeline__step", index === activePhaseIndex && "--active")}
                    onClick={() => scrollToPhase(index)}
                    aria-current={index === activePhaseIndex ? "step" : undefined}
                    aria-label={`Phase ${index + 1}: ${phase.name}`}
                  >
                    <span className="udg-glass-journey-timeline__step-index">{index + 1}</span>
                    <span className="udg-glass-journey-timeline__step-label">{phase.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="udg-glass-journey-timeline__step --cta"
                  onClick={handleAddPhase}
                  disabled={addingPhase}
                >
                  <MaterialSymbol icon="add" fontSize={16} /> Phase hinzufügen
                </button>
              </div>
              <div
                className="udg-glass-journey-timeline__viewport"
                ref={timelineRef}
                onScroll={handleTimelineScroll}
                tabIndex={0}
                onKeyDown={handleTimelineKeyDown}
                aria-label="Journey phases timeline"
              >
                {journey.phases.map((phase, index) => (
                  <UdgGlassJourneyPhaseCard
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
                  <form
                    className="udg-glass-journey-phase udg-glass-journey-phase__form"
                    onSubmit={handleSubmitPhase}
                    aria-label="Create new phase"
                  >
                    <div className="udg-glass-journey-phase__form-header">
                      <div className="udg-glass-journey-phase__badge">
                        {editingPhaseId
                          ? journey.phases.findIndex((p) => p.id === editingPhaseId) + 1
                          : journey.phases.length + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p className="udg-glass-journey-phase__eyebrow">
                          {editingPhaseId ? "Edit Phase" : "New Phase"}
                        </p>
                        <h4 className="udg-glass-journey-phase__title">
                          {editingPhaseId ? "Update phase details" : "Define the next step"}
                        </h4>
                      </div>
                      {editingPhaseId && (
                        <button
                          type="button"
                          className="udg-glass-button --ghost"
                          onClick={() => {
                            setPhaseFormExpanded(false);
                            setEditingPhaseId(null);
                            setPhaseFormData({
                              name: "",
                              description: "",
                              phase_order: journey.phases.length + 1,
                              expected_duration_min: undefined,
                              expected_duration_max: undefined,
                              duration_unit: "minutes",
                              expected_emotion: undefined,
                              emotion_intensity: undefined,
                            });
                            setMomentDrafts([]);
                            setMomentsError(null);
                            setError(null);
                          }}
                          disabled={addingPhase}
                          style={{ padding: "0.375rem" }}
                          title="Cancel editing"
                        >
                          <MaterialSymbol icon="close" fontSize={18} />
                        </button>
                      )}
                    </div>
                    {error && (
                      <div className="udg-glass-journey-phase__form-error">
                        <strong>Error:</strong> {error}
                      </div>
                    )}
                    <label className="udg-glass-journey-phase__form-field">
                      <span>Name *</span>
                      <input
                        value={phaseFormData.name}
                        onChange={(e) => setPhaseFormData({ ...phaseFormData, name: e.target.value })}
                        placeholder="e.g., Awareness, Consideration"
                        required
                        disabled={addingPhase}
                      />
                    </label>
                    <label className="udg-glass-journey-phase__form-field">
                      <span>Description</span>
                      <textarea
                        value={phaseFormData.description}
                        onChange={(e) => setPhaseFormData({ ...phaseFormData, description: e.target.value })}
                        placeholder="Describe the goal, mindset or tasks in this phase."
                        rows={3}
                        disabled={addingPhase}
                      />
                    </label>
                    <div className="udg-glass-journey-phase__form-grid">
                      <label className="udg-glass-journey-phase__form-field">
                        <span>Duration Min</span>
                        <input
                          type="number"
                          value={phaseFormData.expected_duration_min ?? ""}
                          onChange={(e) =>
                            setPhaseFormData({
                              ...phaseFormData,
                              expected_duration_min: e.target.value ? parseInt(e.target.value) : undefined,
                            })
                          }
                          min={0}
                          disabled={addingPhase}
                        />
                      </label>
                      <label className="udg-glass-journey-phase__form-field">
                        <span>Duration Max</span>
                        <input
                          type="number"
                          value={phaseFormData.expected_duration_max ?? ""}
                          onChange={(e) =>
                            setPhaseFormData({
                              ...phaseFormData,
                              expected_duration_max: e.target.value ? parseInt(e.target.value) : undefined,
                            })
                          }
                          min={0}
                          disabled={addingPhase}
                        />
                      </label>
                      <label className="udg-glass-journey-phase__form-field">
                        <span>Unit</span>
                        <select
                          value={phaseFormData.duration_unit}
                          onChange={(e) => setPhaseFormData({ ...phaseFormData, duration_unit: e.target.value })}
                          disabled={addingPhase}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </label>
                    </div>
                    <label className="udg-glass-journey-phase__form-field">
                      <span>Expected Emotion</span>
                      <input
                        value={phaseFormData.expected_emotion ?? ""}
                        onChange={(e) =>
                          setPhaseFormData({
                            ...phaseFormData,
                            expected_emotion: e.target.value || undefined,
                          })
                        }
                        placeholder="e.g., excited, anxious"
                        disabled={addingPhase}
                      />
                    </label>
                    <div className="udg-glass-journey-phase__section">
                      <div className="udg-glass-journey-phase__section-header">
                        <div>
                          <p className="udg-glass-journey-phase__section-label">Journey Moments</p>
                          <p className="udg-glass-journey-phase__section-hint">
                            Erfasse zentrale Aktionen, Gedanken oder Touchpoints dieser Phase.
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <UdgGlassAiButton
                            templates={[{ id: "journey.moments", label: "AI Vorschlag", maxSuggestions: 4 }]}
                            onClick={triggerMomentGeneration}
                            disabled={!journey || addingPhase || aiAssistLoading}
                            loading={aiAssistLoading}
                            size="small"
                            title="AI Vorschlag"
                          />
                          <button type="button" className="udg-glass-button --ghost" onClick={addMomentDraft}>
                            <MaterialSymbol icon="add_circle" fontSize={14} /> Moment hinzufügen
                          </button>
                        </div>
                      </div>
                      {momentsError && (
                        <div className="udg-glass-journey-phase__form-error">
                          <strong>Hinweis:</strong> {momentsError}
                        </div>
                      )}
                      {momentDrafts.length === 0 ? (
                        <p className="udg-glass-journey-phase__empty">Keine Journey Moments hinzugefügt.</p>
                      ) : (
                        <div className="udg-glass-journey-phase__moment-list">
                          {momentDrafts.map((moment) => (
                            <div key={moment.id} className="udg-glass-journey-phase__moment-row">
                              <label className="udg-glass-journey-phase__form-field" style={{ width: "140px" }}>
                                <span>Type</span>
                                <select
                                  value={moment.element_type}
                                  onChange={(e) =>
                                    updateMomentDraft(moment.id, {
                                      element_type: e.target.value as JourneyElementType,
                                    })
                                  }
                                  disabled={addingPhase}
                                >
                                  {ELEMENT_TYPE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                      {option.replace("_", " ")}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="udg-glass-journey-phase__form-field" style={{ flex: 1 }}>
                                <span>Beschreibung</span>
                                <textarea
                                  value={moment.content}
                                  onChange={(e) => updateMomentDraft(moment.id, { content: e.target.value })}
                                  rows={3}
                                  disabled={addingPhase}
                                  placeholder="Beschreibe den Touchpoint oder Gedanken..."
                                />
                              </label>
                              <button
                                type="button"
                                className="udg-glass-button --ghost"
                                onClick={() => removeMomentDraft(moment.id)}
                                disabled={addingPhase}
                                style={{ alignSelf: "flex-start", marginTop: "1.75rem" }}
                                title="Moment entfernen"
                              >
                                <MaterialSymbol icon="close" fontSize={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="udg-glass-journey-phase__form-actions">
                      <button
                        type="button"
                        className="udg-glass-button --ghost"
                        onClick={() => {
                          setPhaseFormExpanded(false);
                          setEditingPhaseId(null);
                          setMomentDrafts([]);
                          setMomentsError(null);
                          setError(null);
                          const nextOrder = journey ? journey.phases.length + 1 : 1;
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
                        }}
                        disabled={addingPhase}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="udg-glass-button"
                        disabled={addingPhase || !phaseFormData.name.trim()}
                      >
                        {addingPhase ? (
                          <>
                            <MaterialSymbol icon="hourglass_empty" fontSize={14} /> {editingPhaseId ? "Updating..." : "Adding..."}
                          </>
                        ) : (
                          <>
                            <MaterialSymbol icon={editingPhaseId ? "save" : "add"} fontSize={14} /> {editingPhaseId ? "Update Phase" : "Add Phase"}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="udg-glass-journey-phase --cta" style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={handleAddPhase}
                      disabled={addingPhase || aiAssistLoading}
                      aria-label="Add a new phase"
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: addingPhase || aiAssistLoading ? "not-allowed" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div className="udg-glass-journey-phase__cta-icon">
                        <MaterialSymbol icon="add" fontSize={28} />
                      </div>
                      <p className="udg-glass-journey-phase__cta-title">Add phase</p>
                      <p className="udg-glass-journey-phase__cta-subtitle">
                        Extend the journey with another touchpoint, task or feeling.
                      </p>
                    </button>
                    <div
                      style={{
                        position: "absolute",
                        bottom: "1rem",
                        right: "1rem",
                        display: "flex",
                        gap: "0.5rem",
                      }}
                    >
                      <UdgGlassAiButton
                        templates={[{ id: "journey.phase.create", label: "AI Generate Phase", maxSuggestions: 1 }]}
                        onClick={handleGeneratePhaseWithAI}
                        disabled={!journey || addingPhase || aiAssistLoading}
                        loading={aiAssistLoading}
                        size="small"
                        title="Generate phase with AI"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="udg-glass-journey-timeline__status" aria-live="polite">
                Phase {activePhaseIndex + 1} of {journey.phases.length}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
