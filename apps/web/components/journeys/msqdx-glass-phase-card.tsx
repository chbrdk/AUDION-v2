"use client";

import { useState } from "react";
import clsx from "clsx";

import type { JourneyResponse } from "../../app/api/_lib/journeys";
import { MaterialSymbol } from "../material-symbol";
import { MsqdxGlassAiFieldButton } from "../ai/msqdx-glass-ai-field-button";
import { MsqdxGlassAiButton } from "../ai/msqdx-glass-ai-button";
import { MsqdxGlassEditButton } from "../generic/msqdx-glass-edit-button";
import { useAiAssist } from "../../hooks/use-ai-assist";

type JourneyPhase = JourneyResponse["phases"][number];

type MsqdxGlassJourneyPhaseCardProps = {
  phase: JourneyPhase;
  index: number;
  isActive: boolean;
  journeyId: string;
  journey?: Pick<JourneyResponse, "name" | "journey_type" | "description" | "target_group_id">;
  onSave?: (phaseId: string, data: Partial<JourneyPhase>) => Promise<void>;
  onCancel?: () => void;
  onDelete?: (phaseId: string) => Promise<void>;
};

const elementIconMap: Record<string, string> = {
  action: "trending_up",
  thought: "psychology_alt",
  feeling: "sentiment_satisfied",
  touchpoint: "hub",
  pain_point: "warning",
  opportunity: "lightbulb",
  question: "help",
  quote: "format_quote",
};

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

type MomentDraft = {
  id: string;
  element_type: JourneyElementType;
  content: string;
};

const formatDuration = (phase: JourneyPhase) => {
  if (phase.expected_duration_min && phase.expected_duration_max) {
    return `${phase.expected_duration_min}-${phase.expected_duration_max} ${phase.duration_unit ?? "minutes"}`;
  }
  if (phase.expected_duration_min) {
    return `${phase.expected_duration_min}+ ${phase.duration_unit ?? "minutes"}`;
  }
  return null;
};

export const MsqdxGlassJourneyPhaseCard = ({
  phase,
  index,
  isActive,
  journeyId,
  journey,
  onSave,
  onCancel,
  onDelete,
}: MsqdxGlassJourneyPhaseCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { execute: runAiAssist, loading: aiAssistLoading } = useAiAssist();
  const [formData, setFormData] = useState({
    name: phase.name,
    description: phase.description || "",
    expected_duration_min: phase.expected_duration_min ?? undefined,
    expected_duration_max: phase.expected_duration_max ?? undefined,
    duration_unit: phase.duration_unit || "minutes",
    expected_emotion: phase.expected_emotion || undefined,
    emotion_intensity: phase.emotion_intensity ?? undefined,
  });
  const [momentDrafts, setMomentDrafts] = useState<MomentDraft[]>(() => {
    return (phase.elements || [])
      .sort((a, b) => a.element_order - b.element_order)
      .map((element) => ({
        id: `element-${element.id}`,
        element_type: element.element_type as JourneyElementType,
        content: element.content,
      }));
  });

  const durationLabel = formatDuration(phase);
  const emotionLabel = phase.expected_emotion
    ? `${phase.expected_emotion}${phase.emotion_intensity ? ` • ${Math.round(phase.emotion_intensity * 100)}%` : ""}`
    : null;
  const validationLabel =
    typeof phase.validation_score === "number"
      ? `${phase.validation_score.toFixed(1)}% fit`
      : phase.validation_status
        ? phase.validation_status
        : null;
  const chips = [
    durationLabel ? { icon: "schedule", label: durationLabel } : null,
    emotionLabel ? { icon: "mood", label: emotionLabel } : null,
    validationLabel ? { icon: "verified", label: validationLabel } : null,
    phase.generated_by_ai ? { icon: "auto_awesome", label: "AI generated" } : null,
  ].filter(Boolean) as { icon: string; label: string }[];

  const sortedElements = [...(phase.elements ?? [])].sort((a, b) => a.element_order - b.element_order);
  const highlightedElements = sortedElements.slice(0, 3);
  const elementCount = sortedElements.length;

  const handleStartEdit = () => {
    setIsEditing(true);
    setFormData({
      name: phase.name,
      description: phase.description || "",
      expected_duration_min: phase.expected_duration_min ?? undefined,
      expected_duration_max: phase.expected_duration_max ?? undefined,
      duration_unit: phase.duration_unit || "minutes",
      expected_emotion: phase.expected_emotion || undefined,
      emotion_intensity: phase.emotion_intensity ?? undefined,
    });
    setMomentDrafts(
      (phase.elements || [])
        .sort((a, b) => a.element_order - b.element_order)
        .map((element) => ({
          id: `element-${element.id}`,
          element_type: element.element_type as JourneyElementType,
          content: element.content,
        }))
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      name: phase.name,
      description: phase.description || "",
      expected_duration_min: phase.expected_duration_min ?? undefined,
      expected_duration_max: phase.expected_duration_max ?? undefined,
      duration_unit: phase.duration_unit || "minutes",
      expected_emotion: phase.expected_emotion || undefined,
      emotion_intensity: phase.emotion_intensity ?? undefined,
    });
    setMomentDrafts(
      (phase.elements || [])
        .sort((a, b) => a.element_order - b.element_order)
        .map((element) => ({
          id: `element-${element.id}`,
          element_type: element.element_type as JourneyElementType,
          content: element.content,
        }))
    );
    onCancel?.();
  };

  const handleSave = async () => {
    if (!onSave) return;
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      await onSave(phase.id, {
        ...formData,
        phase_order: phase.phase_order,
        elements: momentDrafts.map((moment, idx) => ({
          id: moment.id.startsWith("element-") ? moment.id.replace("element-", "") : undefined,
          element_type: moment.element_type,
          content: moment.content,
          element_order: idx + 1,
        })) as any,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save phase:", error);
    } finally {
      setSaving(false);
    }
  };

  const addMomentDraft = () => {
    const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);
    setMomentDrafts((prev) => [
      ...prev,
      {
        id: newId,
        element_type: "action",
        content: "",
      },
    ]);
  };

  const updateMomentDraft = (id: string, updates: Partial<MomentDraft>) => {
    setMomentDrafts((prev) => prev.map((moment) => (moment.id === id ? { ...moment, ...updates } : moment)));
  };

  const removeMomentDraft = (id: string) => {
    setMomentDrafts((prev) => prev.filter((moment) => moment.id !== id));
  };

  const handleAiMomentsSuggestion = async () => {
    if (!journey) return;
    if (!formData.name.trim() && !formData.description?.trim()) {
      console.warn("Bitte gib mindestens einen Namen oder eine Beschreibung für die Phase ein.");
      return;
    }

    try {
      const result = await runAiAssist({
        templateId: "journey.moments",
        journeyId,
        phaseContext: {
          name: formData.name,
          description: formData.description,
          expected_emotion: formData.expected_emotion,
        },
        maxSuggestions: 4,
      });

      if (result.suggestions && result.suggestions.length > 0) {
        const newMoments: MomentDraft[] = result.suggestions.map((suggestion) => ({
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36),
          element_type: (suggestion.type as JourneyElementType) || "action",
          content: suggestion.content.trim(),
        }));
        setMomentDrafts((prev) => [...prev, ...newMoments]);
      }
    } catch (err) {
      console.error("AI moments suggestion failed:", err);
    }
  };

  const getTargetGroupSummary = () => {
    // TODO: Load target group data if needed
    // For now, return a placeholder
    return journey?.target_group_id ? `Target Group ID: ${journey.target_group_id}` : "No target group specified";
  };

  const handleAiNameSuggestion = async () => {
    try {
      const result = await runAiAssist({
        templateId: "journey.phase.name",
        journeyId,
        context: {
          journey_name: journey?.name || "",
          journey_type: journey?.journey_type || "",
          phase_description: formData.description,
          phase_expected_emotion: formData.expected_emotion,
          target_group_summary: getTargetGroupSummary(),
        },
      });
      if (result.rawOutput) {
        setFormData({ ...formData, name: result.rawOutput.trim() });
      }
    } catch (err) {
      console.error("AI name suggestion failed:", err);
    }
  };

  const handleAiDescriptionSuggestion = async () => {
    try {
      const result = await runAiAssist({
        templateId: "journey.description",
        journeyId,
        context: {
          journey_name: journey?.name || "",
          journey_type: journey?.journey_type || "",
          phase_name: formData.name,
          phase_description: formData.description,
          phase_expected_emotion: formData.expected_emotion,
          target_group_summary: getTargetGroupSummary(),
        },
      });
      if (result.rawOutput) {
        setFormData({ ...formData, description: result.rawOutput.trim() });
      }
    } catch (err) {
      console.error("AI description suggestion failed:", err);
    }
  };

  const handleAiEmotionSuggestion = async () => {
    try {
      const result = await runAiAssist({
        templateId: "journey.phase.emotion",
        journeyId,
        context: {
          journey_name: journey?.name || "",
          phase_name: formData.name,
          phase_description: formData.description,
          target_group_summary: getTargetGroupSummary(),
        },
      });
      if (result.rawOutput) {
        // Extract only the emotion word (first word, max 64 chars)
        const validEmotions = ["frustrated", "anxious", "neutral", "hopeful", "satisfied", "delighted"];
        const cleaned = result.rawOutput.trim().toLowerCase();
        // Try to find a valid emotion in the response
        let emotion = validEmotions.find((e) => cleaned.includes(e));
        // If no valid emotion found, take the first word and limit to 64 chars
        if (!emotion) {
          emotion = cleaned.split(/\s+/)[0].substring(0, 64);
        }
        setFormData({ ...formData, expected_emotion: emotion });
      }
    } catch (err) {
      console.error("AI emotion suggestion failed:", err);
    }
  };

  if (isEditing) {
    return (
      <article
        className={clsx("msqdx-glass-journey-phase", "--editing", isActive && "--active")}
        data-phase-index={index}
        aria-label={`Phase ${index + 1}: ${formData.name}`}
      >
        <div className="msqdx-glass-journey-phase__header">
          <div className="msqdx-glass-journey-phase__badge">{index + 1}</div>
          <div style={{ flex: 1, position: "relative" }}>
            <p className="msqdx-glass-journey-phase__eyebrow">Phase</p>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="msqdx-glass-journey-phase__title-input"
              placeholder="Phase name"
              disabled={saving}
              style={{ paddingRight: "2.5rem" }}
            />
            <MsqdxGlassAiFieldButton
              onClick={handleAiNameSuggestion}
              loading={aiAssistLoading}
              disabled={saving}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="msqdx-glass-button --ghost"
              onClick={handleCancel}
              disabled={saving}
              style={{ padding: "0.375rem" }}
              title="Cancel"
            >
              <MaterialSymbol icon="close" fontSize={16} />
            </button>
            <button
              type="button"
              className="msqdx-glass-button"
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              style={{ padding: "0.375rem" }}
              title="Save"
            >
              <MaterialSymbol icon={saving ? "hourglass_empty" : "check"} fontSize={16} />
            </button>
          </div>
        </div>

        <div className="msqdx-glass-journey-phase__section" style={{ position: "relative" }}>
          <p className="msqdx-glass-journey-phase__section-label">Focus</p>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="msqdx-glass-journey-phase__description-input"
            placeholder="Describe the goal, mindset or tasks in this phase."
            rows={3}
            disabled={saving}
            style={{ paddingRight: "2.5rem", paddingBottom: "2.5rem" }}
          />
          <MsqdxGlassAiFieldButton
            onClick={handleAiDescriptionSuggestion}
            loading={aiAssistLoading}
            disabled={saving}
          />
        </div>

        <div className="msqdx-glass-journey-phase__form-grid">
          <label className="msqdx-glass-journey-phase__form-field">
            <span>Duration Min</span>
            <input
              type="number"
              value={formData.expected_duration_min ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expected_duration_min: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              min={0}
              disabled={saving}
            />
          </label>
          <label className="msqdx-glass-journey-phase__form-field">
            <span>Duration Max</span>
            <input
              type="number"
              value={formData.expected_duration_max ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expected_duration_max: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              min={0}
              disabled={saving}
            />
          </label>
          <label className="msqdx-glass-journey-phase__form-field">
            <span>Unit</span>
            <select
              value={formData.duration_unit}
              onChange={(e) => setFormData({ ...formData, duration_unit: e.target.value })}
              disabled={saving}
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </label>
          <label className="msqdx-glass-journey-phase__form-field" style={{ position: "relative" }}>
            <span>Expected Emotion</span>
            <input
              type="text"
              value={formData.expected_emotion ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expected_emotion: e.target.value || undefined,
                })
              }
              placeholder="e.g., excited, anxious"
              disabled={saving}
              style={{ paddingRight: "2.5rem" }}
            />
            <MsqdxGlassAiFieldButton
              onClick={handleAiEmotionSuggestion}
              loading={aiAssistLoading}
              disabled={saving}
            />
          </label>
        </div>

        <div className="msqdx-glass-journey-phase__section">
          <div className="msqdx-glass-journey-phase__section-header">
            <div>
              <p className="msqdx-glass-journey-phase__section-label">Journey Moments</p>
              <p className="msqdx-glass-journey-phase__section-hint">
                Erfasse zentrale Aktionen, Gedanken oder Touchpoints dieser Phase.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <MsqdxGlassAiButton
                templates={[{ id: "journey.moments", label: "AI Vorschlag", maxSuggestions: 4 }]}
                onClick={handleAiMomentsSuggestion}
                disabled={!journey || saving || aiAssistLoading}
                loading={aiAssistLoading}
                size="small"
                title="AI Vorschlag"
              />
              <button
                type="button"
                className="msqdx-glass-button --ghost"
                onClick={addMomentDraft}
                disabled={saving}
              >
                <MaterialSymbol icon="add_circle" fontSize={14} /> Moment hinzufügen
              </button>
            </div>
          </div>
          {momentDrafts.length === 0 ? (
            <p className="msqdx-glass-journey-phase__empty">Keine Journey Moments hinzugefügt.</p>
          ) : (
            <div className="msqdx-glass-journey-phase__moment-list">
              {momentDrafts.map((moment) => (
                <div key={moment.id} className="msqdx-glass-journey-phase__moment-row">
                  <label className="msqdx-glass-journey-phase__form-field" style={{ width: "140px" }}>
                    <span>Type</span>
                    <select
                      value={moment.element_type}
                      onChange={(e) =>
                        updateMomentDraft(moment.id, {
                          element_type: e.target.value as JourneyElementType,
                        })
                      }
                      disabled={saving}
                    >
                      {ELEMENT_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="msqdx-glass-journey-phase__form-field" style={{ flex: 1 }}>
                    <span>Beschreibung</span>
                    <textarea
                      value={moment.content}
                      onChange={(e) => updateMomentDraft(moment.id, { content: e.target.value })}
                      rows={2}
                      disabled={saving}
                      placeholder="Beschreibe den Touchpoint oder Gedanken..."
                    />
                  </label>
                  <button
                    type="button"
                    className="msqdx-glass-button --ghost"
                    onClick={() => removeMomentDraft(moment.id)}
                    disabled={saving}
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
      </article>
    );
  }

  return (
    <article
      className={clsx("msqdx-glass-journey-phase", isActive && "--active")}
      data-phase-index={index}
      aria-label={`Phase ${index + 1}: ${phase.name}`}
    >
      <div className="msqdx-glass-journey-phase__header">
        <div className="msqdx-glass-journey-phase__badge">{index + 1}</div>
        <div style={{ flex: 1 }}>
          <p className="msqdx-glass-journey-phase__eyebrow">Phase</p>
          <h4 className="msqdx-glass-journey-phase__title">{phase.name}</h4>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <MsqdxGlassEditButton
            onClick={handleStartEdit}
            size="small"
            fontSize={16}
            aria-label="Edit phase"
          />
          {onDelete && (
            <button
              type="button"
              className="msqdx-glass-button --ghost"
              onClick={async (e) => {
                e.stopPropagation();
                if (confirm(`Möchtest du die Phase "${phase.name}" wirklich löschen?`)) {
                  try {
                    await onDelete(phase.id);
                  } catch (err) {
                    console.error("Failed to delete phase:", err);
                  }
                }
              }}
              style={{ padding: "0.375rem" }}
              title="Delete phase"
              aria-label="Delete phase"
            >
              <MaterialSymbol icon="delete" fontSize={16} />
            </button>
          )}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="msqdx-glass-journey-phase__chips">
          {chips.map((chip) => (
            <span key={chip.label} className="msqdx-glass-journey-phase__chip">
              <MaterialSymbol icon={chip.icon} fontSize={14} /> {chip.label}
            </span>
          ))}
        </div>
      )}

      <div className="msqdx-glass-journey-phase__section">
        <p className="msqdx-glass-journey-phase__section-label">Focus</p>
        <p className="msqdx-glass-journey-phase__description">
          {phase.description || "No description yet. Capture the goal and emotional state of this phase."}
        </p>
      </div>

      <div className="msqdx-glass-journey-phase__section">
        <p className="msqdx-glass-journey-phase__section-label">Journey Moments</p>
        {highlightedElements.length === 0 ? (
          <p className="msqdx-glass-journey-phase__empty">No elements yet. Map touchpoints, thoughts or feelings.</p>
        ) : (
          <ul className="msqdx-glass-journey-phase__list">
            {highlightedElements.map((element) => (
              <li key={element.id}>
                <span className="msqdx-glass-journey-phase__list-icon">
                  <MaterialSymbol icon={elementIconMap[element.element_type] ?? "trip"} fontSize={14} />
                </span>
                <div>
                  <p className="msqdx-glass-journey-phase__list-label">{element.element_type.replace("_", " ")}</p>
                  <p className="msqdx-glass-journey-phase__list-value">{element.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

    </article>
  );
};

export type MsqdxGlassPhaseCardProps = {
  phase: JourneyPhase;
  index: number;
  isSelected?: boolean;
  onSelect?: () => void;
};

export const MsqdxGlassPhaseCard = ({
  phase,
  index,
  isSelected,
  onSelect,
}: MsqdxGlassPhaseCardProps) => {
  const getStatusColor = (status?: string | null) => {
    if (!status) return "var(--color-text-secondary)";
    switch (status.toLowerCase()) {
      case "good":
        return "var(--color-success)";
      case "warning":
        return "var(--color-warning)";
      case "critical":
        return "var(--color-error)";
      default:
        return "var(--color-text-secondary)";
    }
  };

  return (
    <div
      className="msqdx-glass-card"
      style={{
        minWidth: "250px",
        cursor: "pointer",
        border: isSelected ? "2px solid var(--color-theme-accent)" : "1px solid var(--color-border)",
        backgroundColor: isSelected ? "rgba(99, 102, 241, 0.08)" : undefined,
      }}
      onClick={onSelect}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: "var(--color-theme-accent)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.875rem",
              fontWeight: "bold",
            }}
          >
            {index + 1}
          </span>
          <h3 style={{ margin: 0 }}>{phase.name}</h3>
        </div>
        {typeof phase.validation_score === "number" && (
          <span
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              fontSize: "0.75rem",
              backgroundColor: getStatusColor(phase.validation_status),
              color: "white",
            }}
          >
            {phase.validation_score.toFixed(0)}%
          </span>
        )}
      </div>

      {phase.description && (
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginTop: "0.5rem", marginBottom: "0.5rem" }}>
          {phase.description}
        </p>
      )}

      <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "0.5rem" }}>
        {phase.expected_duration_min && phase.expected_duration_max && (
          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <MaterialSymbol icon="schedule" fontSize={14} />
            {phase.expected_duration_min}-{phase.expected_duration_max} {phase.duration_unit}
          </span>
        )}
        {phase.expected_emotion && (
          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <MaterialSymbol icon="mood" fontSize={14} />
            {phase.expected_emotion}
          </span>
        )}
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <MaterialSymbol icon="list" fontSize={14} />
          {phase.elements.length} elements
        </span>
      </div>

      {phase.generated_by_ai && (
        <div style={{ marginTop: "0.5rem", padding: "0.25rem 0.5rem", backgroundColor: "var(--color-surface)", borderRadius: "4px", fontSize: "0.75rem" }}>
          <MaterialSymbol icon="auto_awesome" fontSize={12} /> AI Generated
        </div>
      )}
    </div>
  );
};
