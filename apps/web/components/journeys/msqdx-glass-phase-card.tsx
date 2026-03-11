"use client";

import { useState } from "react";
import { Box } from "@mui/material";

import type { JourneyResponse } from "../../app/api/_lib/journeys";
import {
  MsqdxIcon,
  MsqdxButton,
  MsqdxTypography,
  MsqdxCard,
  MsqdxChip,
  MsqdxDivider,
  MsqdxFormField,
  MsqdxTextareaField,
  MsqdxSelect,
  MsqdxSnackbar,
} from "@msqdx/react";
import { MsqdxGlassAiFieldButton } from "../ai/msqdx-glass-ai-field-button";
import { MsqdxGlassAiButton } from "../ai/msqdx-glass-ai-button";
import { MsqdxGlassEditButton } from "../generic/msqdx-glass-edit-button";
import { useAiAssist, type UiAiAssistResult, type AiAssistExecuteOptions } from "../../hooks/use-ai-assist";
import { useI18n } from "../i18n/i18n-provider";
import { FORM_FIELD_ACCENT_SX, DIVIDER_ACCENT_SX, THEME_ACCENT } from "../../lib/theme-accent";
import { MSQDX_SPACING, MSQDX_EFFECTS } from "@msqdx/tokens";

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
  const [aiSnackbar, setAiSnackbar] = useState<{
    open: boolean;
    message: string;
    autoHide: number | null;
    key: number;
  }>({ open: false, message: "", autoHide: null, key: 0 });
  const { execute: runAiAssist, loading: aiAssistLoading } = useAiAssist();
  const { t } = useI18n();

  const runAiWithSnackbar = async <T = UiAiAssistResult>(
    options: AiAssistExecuteOptions,
    successMessage: string
  ): Promise<T> => {
    setAiSnackbar({ open: true, message: t("journeys.ai.generating"), autoHide: null, key: 0 });
    try {
      const result = (await runAiAssist(options)) as T;
      setAiSnackbar((prev) => ({
        open: true,
        message: successMessage,
        autoHide: 5000,
        key: prev.key + 1,
      }));
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t("journeys.ai.requestFailed");
      setAiSnackbar((prev) => ({
        open: true,
        message: errMsg,
        autoHide: 5000,
        key: prev.key + 1,
      }));
      throw err;
    }
  };
  const [formData, setFormData] = useState({
    name: phase.name,
    description: phase.description || "",
    expected_duration_min: phase.expected_duration_min ?? undefined,
    expected_duration_max: phase.expected_duration_max ?? undefined,
    duration_unit: phase.duration_unit || "minutes",
    expected_emotion: phase.expected_emotion || undefined,
    emotion_intensity: phase.emotion_intensity ?? undefined,
  });
  const [momentDrafts, setMomentDrafts] = useState<MomentDraft[]>(() =>
    (phase.elements || [])
      .sort((a, b) => a.element_order - b.element_order)
      .map((el) => ({
        id: `element-${el.id}`,
        element_type: el.element_type as JourneyElementType,
        content: el.content,
      }))
  );

  const durationLabel = formatDuration(phase);
  const emotionLabel = phase.expected_emotion
    ? `${phase.expected_emotion}${phase.emotion_intensity ? ` • ${Math.round(phase.emotion_intensity * 100)}%` : ""}`
    : null;
  const validationLabel =
    typeof phase.validation_score === "number"
      ? `${phase.validation_score.toFixed(1)}% fit`
      : phase.validation_status ?? null;
  const chips = [
    durationLabel ? { icon: "schedule" as const, label: durationLabel } : null,
    emotionLabel ? { icon: "mood" as const, label: emotionLabel } : null,
    validationLabel ? { icon: "verified" as const, label: validationLabel } : null,
    phase.generated_by_ai ? { icon: "auto_awesome" as const, label: t("journeys.editor.aiGenerated") } : null,
  ].filter(Boolean) as { icon: string; label: string }[];

  const sortedElements = [...(phase.elements ?? [])].sort((a, b) => a.element_order - b.element_order);
  const highlightedElements = sortedElements.slice(0, 3);

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
        .map((el) => ({
          id: `element-${el.id}`,
          element_type: el.element_type as JourneyElementType,
          content: el.content,
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
        .map((el) => ({
          id: `element-${el.id}`,
          element_type: el.element_type as JourneyElementType,
          content: el.content,
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
        elements: momentDrafts.map((m, idx) => ({
          id: m.id.startsWith("element-") ? m.id.replace("element-", "") : undefined,
          element_type: m.element_type,
          content: m.content,
          element_order: idx + 1,
        })) as any,
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save phase:", err);
    } finally {
      setSaving(false);
    }
  };

  const addMomentDraft = () => {
    const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);
    setMomentDrafts((prev) => [...prev, { id: newId, element_type: "action", content: "" }]);
  };

  const updateMomentDraft = (id: string, updates: Partial<MomentDraft>) => {
    setMomentDrafts((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const removeMomentDraft = (id: string) => {
    setMomentDrafts((prev) => prev.filter((m) => m.id !== id));
  };

  const getTargetGroupSummary = () =>
    journey?.target_group_id ? `Target Group ID: ${journey.target_group_id}` : "No target group specified";

  const handleAiMomentsSuggestion = async () => {
    if (!journey || (!formData.name.trim() && !formData.description?.trim())) return;
    try {
      const result = await runAiWithSnackbar<UiAiAssistResult>(
        {
          templateId: "journey.moments",
          journeyId,
          phaseContext: {
            name: formData.name,
            description: formData.description,
            expected_emotion: formData.expected_emotion,
          },
          maxSuggestions: 4,
        },
        t("journeys.ai.momentsGenerated")
      );
      if (result.suggestions?.length) {
        const newMoments: MomentDraft[] = result.suggestions.map((s) => ({
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36),
          element_type: (s.type as JourneyElementType) || "action",
          content: s.content.trim(),
        }));
        setMomentDrafts((prev) => [...prev, ...newMoments]);
      }
    } catch (err) {
      console.error("AI moments suggestion failed:", err);
    }
  };

  const handleAiNameSuggestion = async () => {
    try {
      const result = await runAiWithSnackbar<UiAiAssistResult>(
        {
          templateId: "journey.phase.name",
          journeyId,
          context: {
            journey_name: journey?.name || "",
            journey_type: journey?.journey_type || "",
            phase_description: formData.description,
            phase_expected_emotion: formData.expected_emotion,
            target_group_summary: getTargetGroupSummary(),
          },
        },
        t("journeys.ai.nameGenerated")
      );
      if (result.rawOutput) setFormData({ ...formData, name: result.rawOutput.trim() });
    } catch (err) {
      console.error("AI name suggestion failed:", err);
    }
  };

  const handleAiDescriptionSuggestion = async () => {
    try {
      const result = await runAiWithSnackbar<UiAiAssistResult>(
        {
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
        },
        t("journeys.ai.descriptionGenerated")
      );
      if (result.rawOutput) setFormData({ ...formData, description: result.rawOutput.trim() });
    } catch (err) {
      console.error("AI description suggestion failed:", err);
    }
  };

  const handleAiEmotionSuggestion = async () => {
    try {
      const result = await runAiWithSnackbar<UiAiAssistResult>(
        {
          templateId: "journey.phase.emotion",
          journeyId,
          context: {
            journey_name: journey?.name || "",
            phase_name: formData.name,
            phase_description: formData.description,
            target_group_summary: getTargetGroupSummary(),
          },
        },
        t("journeys.ai.emotionGenerated")
      );
      if (result.rawOutput) {
        const validEmotions = ["frustrated", "anxious", "neutral", "hopeful", "satisfied", "delighted"];
        const cleaned = result.rawOutput.trim().toLowerCase();
        let emotion = validEmotions.find((e) => cleaned.includes(e));
        if (!emotion) emotion = cleaned.split(/\s+/)[0]?.substring(0, 64);
        setFormData({ ...formData, expected_emotion: emotion });
      }
    } catch (err) {
      console.error("AI emotion suggestion failed:", err);
    }
  };

  const aiSnackbarClose = (_event: React.SyntheticEvent | Event, reason: string) => {
    setAiSnackbar((prev) => ({ ...prev, open: false }));
  };

  if (isEditing) {
    return (
      <>
      <Box
        component="article"
        data-phase-index={index}
        aria-label={t("journeys.editor.phaseCardAria", { number: index + 1, name: formData.name })}
        sx={{ minWidth: 380 }}
      >
        <MsqdxCard className="msqdx-glass-journey-phase-card" variant="flat" borderRadius="button" sx={{ borderColor: THEME_ACCENT.borderColor }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "stretch" }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "full",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </Box>
              <Box sx={{ flex: 1, position: "relative" }}>
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
                  {t("journeys.editor.phase")}
                </MsqdxTypography>
                <MsqdxFormField
                  label=""
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("journeys.editor.placeholderPhaseName")}
                  disabled={saving}
                  fullWidth
                  size="small"
                  sx={{ ...FORM_FIELD_ACCENT_SX, "& .MuiInputBase-root": { pr: 5 } }}
                />
                <Box sx={{ position: "absolute", top: 28, right: 8 }}>
                  <MsqdxGlassAiFieldButton onClick={handleAiNameSuggestion} loading={aiAssistLoading} disabled={saving} />
                </Box>
              </Box>
              <Box sx={{ display: "flex", gap: "8px" }}>
                <MsqdxButton variant="text" size="small" onClick={handleCancel} disabled={saving} aria-label={t("journeys.editor.cancel")}>
                  <MsqdxIcon name="close" customSize={16} />
                </MsqdxButton>
                <MsqdxButton
                  variant="contained"
                  size="small"
                  sx={{ backgroundColor: THEME_ACCENT.backgroundColor, "&:hover": { backgroundColor: THEME_ACCENT.backgroundColor, filter: "brightness(1.1)" } }}
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim()}
                  aria-label={t("common.save")}
                >
                  <MsqdxIcon name={saving ? "hourglass_empty" : "check"} customSize={16} />
                </MsqdxButton>
              </Box>
            </Box>

            <MsqdxDivider orientation="horizontal" spacing="xs" sx={DIVIDER_ACCENT_SX} />

            <Box sx={{ position: "relative" }}>
              <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
                {t("journeys.editor.focus")}
              </MsqdxTypography>
              <MsqdxTextareaField
                label=""
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("journeys.editor.placeholderDescription")}
                minRows={3}
                disabled={saving}
                fullWidth
                sx={{ ...FORM_FIELD_ACCENT_SX, "& .MuiInputBase-root": { pr: 5, pb: 3 } }}
              />
              <Box sx={{ position: "absolute", bottom: 12, right: 8 }}>
                <MsqdxGlassAiFieldButton
                  onClick={handleAiDescriptionSuggestion}
                  loading={aiAssistLoading}
                  disabled={saving}
                />
              </Box>
            </Box>

            <MsqdxDivider orientation="horizontal" spacing="xs" sx={DIVIDER_ACCENT_SX} />

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              <MsqdxFormField
                label={t("journeys.editor.durationMin")}
                value={String(formData.expected_duration_min ?? "")}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    expected_duration_min: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="0"
                type="number"
                disabled={saving}
                size="small"
                sx={FORM_FIELD_ACCENT_SX}
              />
              <MsqdxFormField
                label={t("journeys.editor.durationMax")}
                value={String(formData.expected_duration_max ?? "")}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    expected_duration_max: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="0"
                type="number"
                disabled={saving}
                size="small"
                sx={FORM_FIELD_ACCENT_SX}
              />
              <MsqdxSelect
                label="Unit"
                value={formData.duration_unit}
                onChange={(e: any) => setFormData({ ...formData, duration_unit: e.target.value })}
                options={[
                  { value: "minutes", label: "Minutes" },
                  { value: "hours", label: "Hours" },
                  { value: "days", label: "Days" },
                ]}
                disabled={saving}
                size="small"
                sx={FORM_FIELD_ACCENT_SX}
              />
            </Box>

            <MsqdxDivider orientation="horizontal" spacing="xs" sx={DIVIDER_ACCENT_SX} />

            <Box sx={{ position: "relative" }}>
              <MsqdxFormField
                label={t("journeys.editor.expectedEmotion")}
                value={formData.expected_emotion ?? ""}
                onChange={(e) => setFormData({ ...formData, expected_emotion: e.target.value || undefined })}
                placeholder={t("journeys.editor.placeholderEmotion")}
                disabled={saving}
                size="small"
                fullWidth
                sx={{ ...FORM_FIELD_ACCENT_SX, "& .MuiInputBase-root": { pr: 5 } }}
              />
              <Box sx={{ position: "absolute", top: 28, right: 8 }}>
                <MsqdxGlassAiFieldButton
                  onClick={handleAiEmotionSuggestion}
                  loading={aiAssistLoading}
                  disabled={saving}
                />
              </Box>
            </Box>

            <MsqdxDivider orientation="horizontal" spacing="xs" sx={DIVIDER_ACCENT_SX} />

            <Box sx={{ display: "flex", flexDirection: "column", gap: `${MSQDX_SPACING.gap.xs}px` }}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: `${MSQDX_SPACING.gap.xs}px`,
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <MsqdxTypography variant="caption" weight="semibold" sx={{ display: "block" }}>
                    {t("journeys.editor.journeyMoments")}
                  </MsqdxTypography>
                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                    {t("journeys.editor.journeyMomentsHint")}
                  </MsqdxTypography>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: `${MSQDX_SPACING.gap.xs}px` }}>
                  <MsqdxGlassAiButton
                    templates={[{ id: "journey.moments", label: t("journeys.editor.aiSuggestion"), maxSuggestions: 4 }]}
                    onClick={handleAiMomentsSuggestion}
                    disabled={!journey || saving || aiAssistLoading}
                    loading={aiAssistLoading}
                    size="small"
                    title={t("journeys.editor.aiSuggestion")}
                  />
                  <MsqdxButton
                    variant="outlined"
                    size="small"
                    onClick={addMomentDraft}
                    disabled={saving}
                    startIcon={<MsqdxIcon name="add_circle" customSize={14} />}
                  >
                    {t("journeys.editor.addMoment")}
                  </MsqdxButton>
                </Box>
              </Box>
              {momentDrafts.length === 0 ? (
                <MsqdxTypography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
                  {t("journeys.editor.noMoments")}
                </MsqdxTypography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: `${MSQDX_SPACING.gap.xs}px` }}>
                  {momentDrafts.map((moment) => (
                    <MsqdxCard
                      key={moment.id}
                      variant="flat"
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: `${MSQDX_SPACING.gap.xs}px`,
                        alignItems: "flex-start",
                        p: 1.5,
                      }}
                    >
                      <Box sx={{ width: 140, flexShrink: 0 }}>
                        <MsqdxSelect
                          label={t("journeys.editor.momentType")}
                          value={moment.element_type}
                          onChange={(e: any) => updateMomentDraft(moment.id, { element_type: e.target.value })}
                          options={ELEMENT_TYPE_OPTIONS.map((opt) => ({
                            value: opt,
                            label: opt.replace("_", " "),
                          }))}
                          disabled={saving}
                          size="small"
                          sx={FORM_FIELD_ACCENT_SX}
                        />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <MsqdxTextareaField
                          label={t("journeys.editor.momentDescription")}
                          value={moment.content}
                          onChange={(e) => updateMomentDraft(moment.id, { content: e.target.value })}
                          placeholder={t("journeys.editor.momentDescriptionPlaceholder")}
                          minRows={2}
                          disabled={saving}
                          fullWidth
                          sx={FORM_FIELD_ACCENT_SX}
                        />
                      </Box>
                      <MsqdxButton
                        variant="text"
                        size="small"
                        onClick={() => removeMomentDraft(moment.id)}
                        disabled={saving}
                        aria-label={t("journeys.editor.removeMoment")}
                        sx={{ alignSelf: "flex-start", mt: 2 }}
                      >
                        <MsqdxIcon name="close" customSize={14} />
                      </MsqdxButton>
                    </MsqdxCard>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </MsqdxCard>
      </Box>
      <MsqdxSnackbar
        key={aiSnackbar.key}
        open={aiSnackbar.open}
        onClose={aiSnackbarClose}
        message={aiSnackbar.message}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        autoHideDuration={aiSnackbar.autoHide}
        sx={{ borderColor: THEME_ACCENT.borderColor }}
        variant="outlined"
      />
      </>
    );
  }

  return (
    <Box
      component="article"
      data-phase-index={index}
      aria-label={t("journeys.editor.phaseCardAria", { number: index + 1, name: phase.name })}
      sx={{ minWidth: 380 }}
    >
      <MsqdxCard
        className="msqdx-glass-journey-phase-card"
        variant="flat"
        borderRadius="button"
        sx={{
          height: "100%",
          borderColor: THEME_ACCENT.borderColor,
          boxShadow: isActive ? MSQDX_EFFECTS.tripleBorder.focus : undefined,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "24px" }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "full",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  {t("journeys.editor.phase")}
                </MsqdxTypography>
                <MsqdxTypography variant="h6" weight="semibold">
                  {phase.name}
                </MsqdxTypography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <MsqdxGlassEditButton onClick={handleStartEdit} size="small" fontSize={16} aria-label={t("journeys.editor.editPhase")} />
              {onDelete && (
                <MsqdxButton
                  variant="contained"
                  color="error"
                  size="small"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm(t("journeys.editor.deleteConfirm", { name: phase.name }))) {
                      try {
                        await onDelete(phase.id);
                      } catch (err) {
                        console.error("Failed to delete phase:", err);
                      }
                    }
                  }}
                  aria-label={t("common.delete")}
                  sx={{
                    minWidth: 28,
                    minHeight: 28,
                    width: 28,
                    height: 28,
                    p: 0,
                    borderRadius: "rounded",
                  }}
                >
                  <MsqdxIcon name="delete" customSize={16} />
                </MsqdxButton>
              )}
            </Box>
          </Box>

          <MsqdxDivider spacing="xs" sx={DIVIDER_ACCENT_SX} />

          {chips.length > 0 && (
            <>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {chips.map((chip) => (
                <MsqdxChip
                  key={chip.label}
                  variant="glass"
                  size="small"
                  label={chip.label}
                  icon={<MsqdxIcon name={chip.icon} customSize={14} />}
                />
              ))}
            </Box>
            <MsqdxDivider spacing="xs" sx={DIVIDER_ACCENT_SX} />
            </>
          )}

          <Box>
            <MsqdxTypography variant="caption" weight="semibold" sx={{ display: "block", mb: 0.5 }}>
              Focus
            </MsqdxTypography>
            <MsqdxTypography variant="body2" sx={{ color: "text.primary" }}>
              {phase.description || t("journeys.editor.noDescriptionYet")}
            </MsqdxTypography>
          </Box>

          <MsqdxDivider spacing="xs" sx={DIVIDER_ACCENT_SX} />

          <Box>
            <MsqdxTypography variant="caption" weight="semibold" sx={{ display: "block", mb: 0.5 }}>
              Journey Moments
            </MsqdxTypography>
            {highlightedElements.length === 0 ? (
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                {t("journeys.editor.noElementsYet")}
              </MsqdxTypography>
            ) : (
              <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                {highlightedElements.map((element) => (
                  <Box
                    key={element.id}
                    component="li"
                    sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                  >
                    <Box sx={{ flexShrink: 0, mt: 0.25, color: "text.secondary" }}>
                      <MsqdxIcon
                        name={elementIconMap[element.element_type] ?? "trip"}
                        customSize={14}
                      />
                    </Box>
                    <Box>
                      <MsqdxTypography variant="caption" sx={{ textTransform: "capitalize", display: "block" }}>
                        {element.element_type.replace("_", " ")}
                      </MsqdxTypography>
                      <MsqdxTypography variant="body2">{element.content}</MsqdxTypography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </MsqdxCard>
    </Box>
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
  return (
    <MsqdxCard
      variant="flat"
      clickable={!!onSelect}
      onClick={onSelect}
      sx={{
        minWidth: 250,
        p: 2,
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? "primary.main" : "divider",
        bgcolor: isSelected ? "action.selected" : undefined,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: "full",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.875rem",
              fontWeight: 700,
            }}
          >
            {index + 1}
          </Box>
          <MsqdxTypography variant="h6">{phase.name}</MsqdxTypography>
        </Box>
        {typeof phase.validation_score === "number" && (
          <MsqdxChip
            variant="filled"
            size="small"
            label={`${phase.validation_score.toFixed(0)}%`}
            color={phase.validation_status === "critical" ? "error" : phase.validation_status === "warning" ? "warning" : "success"}
          />
        )}
      </Box>

      {phase.description && (
        <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mt: 0.5, mb: 0.5 }}>
          {phase.description}
        </MsqdxTypography>
      )}

      <Box sx={{ display: "flex", gap: 1, fontSize: "0.75rem", color: "text.secondary", mt: 0.5, flexWrap: "wrap" }}>
        {phase.expected_duration_min != null && phase.expected_duration_max != null && (
          <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
            <MsqdxIcon name="schedule" customSize={14} />
            {phase.expected_duration_min}-{phase.expected_duration_max} {phase.duration_unit}
          </Box>
        )}
        {phase.expected_emotion && (
          <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
            <MsqdxIcon name="mood" customSize={14} />
            {phase.expected_emotion}
          </Box>
        )}
        <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <MsqdxIcon name="list" customSize={14} />
          {phase.elements?.length ?? 0} elements
        </Box>
      </Box>

      {phase.generated_by_ai && (
        <Box sx={{ mt: 0.5, p: 0.5, bgcolor: "action.hover", borderRadius: 1, fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 0.5 }}>
          <MsqdxIcon name="auto_awesome" customSize={12} /> AI Generated
        </Box>
      )}
    </MsqdxCard>
  );
};
