"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import type { TargetGroupListResponse, TargetGroupResponse } from "@msqdx-glass/types";
import {
  MsqdxButton,
  MsqdxCheckboxField,
  MsqdxChip,
  MsqdxFormField,
  MsqdxIcon,
  MsqdxMoleculeCard,
  MsqdxTextareaField,
  MsqdxTypography,
} from "@msqdx/react";
import { MSQDX_TYPOGRAPHY } from "@msqdx/tokens";
import { buildApiUrl } from "../../app/api/_lib/backend";
import { mirrorFillStringPair } from "../../lib/bilingual-mirror";
import {
  suggestProjectTargetGroups,
  type TargetGroupSuggestionDto,
} from "../../lib/projects-suggest-target-groups";
import { ADMIN_ROUTES } from "../../lib/routes";
import { useProject } from "../projects/project-provider";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassTargetGroupsOverviewProps = {
  initialList: TargetGroupListResponse;
};

type CreateFormState = {
  name: string;
  segment: string;
  description: string;
  name_de: string;
  segment_de: string;
  description_de: string;
};

const defaultCreateFormState: CreateFormState = {
  name: "",
  segment: "",
  description: "",
  name_de: "",
  segment_de: "",
  description_de: "",
};

function extractTargetGroupId(payload: unknown): string | null {
  const anyPayload = payload as any;
  return anyPayload?.id ?? anyPayload?.targetGroupId ?? anyPayload?.target_group_id ?? null;
}

export function MsqdxGlassTargetGroupsOverview({ initialList }: MsqdxGlassTargetGroupsOverviewProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { activeProjectId, activeProject } = useProject();
  const accent = "var(--color-theme-accent)";

  const [list, setList] = useState<TargetGroupListResponse>(initialList);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateFormState);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<TargetGroupSuggestionDto[]>([]);
  const [selectedAiIndices, setSelectedAiIndices] = useState<Set<number>>(new Set());
  const [expandedAiDetails, setExpandedAiDetails] = useState<Set<number>>(new Set());
  const [aiCreating, setAiCreating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const items = useMemo(() => list.items ?? [], [list.items]);

  const refresh = async (projectId: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        buildApiUrl(`/api/target-groups?page=1&page_size=50&project_id=${encodeURIComponent(projectId)}`),
        { cache: "no-store" }
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail ? `${response.status}: ${detail}` : `Backend responded with ${response.status}`);
      }
      const payload = (await response.json()) as TargetGroupListResponse;
      setList(payload);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load target groups");
      setList({ items: [], total: 0, page: 1, page_size: 50 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeProjectId) {
      setList({ items: [], total: 0, page: 1, page_size: 50 });
      return;
    }
    void refresh(activeProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const handleCreate = async () => {
    const namePair = mirrorFillStringPair(createForm.name, createForm.name_de);
    const segPair = mirrorFillStringPair(createForm.segment, createForm.segment_de);
    const name = namePair.en.trim();
    const segment = segPair.en.trim();
    if (!activeProjectId || !name || !segment) {
      setCreateError(t("targetGroupsAdmin.toasts.projectNameSegmentRequired"));
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const descPair = mirrorFillStringPair(createForm.description, createForm.description_de);
      const payload = {
        project_id: activeProjectId,
        name: namePair.en.trim(),
        segment: segPair.en.trim(),
        description: descPair.en.trim() || null,
        name_de: namePair.de.trim() || null,
        segment_de: segPair.de.trim() || null,
        description_de: descPair.de.trim() || null,
      };

      const response = await fetch(buildApiUrl("/api/target-groups"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail ? `${response.status}: ${detail}` : `Backend responded with ${response.status}`);
      }

      const created = (await response.json()) as TargetGroupResponse;
      const newId = extractTargetGroupId(created);
      setCreateForm(defaultCreateFormState);
      setShowCreate(false);
      await refresh(activeProjectId);
      if (newId) {
        router.push(ADMIN_ROUTES.targetGroupDetail(newId));
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("targetGroupsAdmin.toasts.createError"));
    } finally {
      setCreating(false);
    }
  };

  const openAiDialog = async () => {
    if (!activeProjectId) return;
    setAiDialogOpen(true);
    setAiError(null);
    setAiSuggestions([]);
    setSelectedAiIndices(new Set());
    setExpandedAiDetails(new Set());
    setAiLoading(true);
    try {
      const res = await suggestProjectTargetGroups(activeProjectId, { bilingual: true, maxSuggestions: 5 });
      setAiSuggestions(res.suggestions ?? []);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t("targetGroupsAdmin.generateWithAiFailed"));
    } finally {
      setAiLoading(false);
    }
  };

  const toggleAiIndex = (index: number) => {
    setSelectedAiIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAiDetails = (index: number) => {
    setExpandedAiDetails((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleCreateSelectedSuggestions = async () => {
    if (!activeProjectId) return;
    if (selectedAiIndices.size === 0) {
      setAiError(t("targetGroupsAdmin.generateWithAiNoneSelected"));
      return;
    }
    setAiCreating(true);
    setAiError(null);
    let lastId: string | null = null;
    try {
      for (const index of Array.from(selectedAiIndices).sort((a, b) => a - b)) {
        const s = aiSuggestions[index];
        if (!s) continue;
        const namePair = mirrorFillStringPair(s.name, s.name_de ?? "");
        const segPair = mirrorFillStringPair(s.segment, s.segment_de ?? "");
        const descPair = mirrorFillStringPair(s.description ?? "", s.description_de ?? "");
        const payload = {
          project_id: activeProjectId,
          name: namePair.en.trim(),
          segment: segPair.en.trim(),
          description: descPair.en.trim() || null,
          name_de: namePair.de.trim() || null,
          segment_de: segPair.de.trim() || null,
          description_de: descPair.de.trim() || null,
        };
        const response = await fetch(buildApiUrl("/api/target-groups"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(detail || `Backend responded with ${response.status}`);
        }
        const created = (await response.json()) as TargetGroupResponse;
        lastId = extractTargetGroupId(created) ?? created.id ?? null;
      }
      setAiDialogOpen(false);
      setAiSuggestions([]);
      setSelectedAiIndices(new Set());
      await refresh(activeProjectId);
      if (lastId) {
        router.push(ADMIN_ROUTES.targetGroupDetail(lastId));
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t("targetGroupsAdmin.generateWithAiFailed"));
    } finally {
      setAiCreating(false);
    }
  };

  return (
    <Box sx={{ width: "100%" }} className="msqdx-glass-target-groups-overview">
      <Box
        className="msqdx-glass-target-groups-grid"
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          },
          gap: 2,
          alignItems: "start",
        }}
      >
        {/* Create Target Group */}
        {!showCreate ? (
          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={() => setShowCreate(true)}
            title={t("targetGroupsAdmin.newTargetGroup")}
            titleVariant="h6"
            subtitle={t("targetGroupsAdmin.namePlaceholder")}
            headerActions={(
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Tooltip title={t("targetGroupsAdmin.generateWithAi")}>
                  <IconButton
                    size="small"
                    aria-label={t("targetGroupsAdmin.generateWithAi")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void openAiDialog();
                    }}
                    disabled={!activeProjectId}
                    sx={{ color: accent }}
                  >
                    <MsqdxIcon name="auto_awesome" customSize={22} />
                  </IconButton>
                </Tooltip>
                <MsqdxIcon name="add" customSize={22} style={{ color: accent }} />
              </Stack>
            )}
            sx={{
              minHeight: 140,
              border: "2px dashed",
              borderColor: accent,
              "& .MuiTypography-h6": { color: accent },
            }}
          />
        ) : (
          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            title={t("targetGroupsAdmin.newTargetGroup")}
            titleVariant="h6"
            sx={{
              minHeight: 140,
              border: "1px solid",
              borderColor: accent,
              "& .MuiTypography-h6": { color: accent },
            }}
            actions={(
              <>
                <MsqdxButton
                  variant="outlined"
                  size="small"
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateForm(defaultCreateFormState);
                    setCreateError(null);
                  }}
                  disabled={creating}
                  sx={{
                    borderColor: accent,
                    color: accent,
                    "&:hover": { borderColor: accent, backgroundColor: "transparent" },
                  }}
                >
                  {t("common.cancel")}
                </MsqdxButton>
                <MsqdxButton
                  variant="contained"
                  size="small"
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !activeProjectId}
                  sx={{
                    backgroundColor: `${accent} !important`,
                    color: "white !important",
                    "&:hover": { backgroundColor: `${accent} !important`, filter: "brightness(1.05)" },
                  }}
                >
                  {t("targetGroupsAdmin.create")}
                </MsqdxButton>
              </>
            )}
          >
            <Stack spacing={1.5}>
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                {activeProject?.name
                  ? t("targetGroupsAdmin.projectLabel", { name: activeProject.name })
                  : activeProjectId
                    ? t("targetGroupsAdmin.projectIdLabel", { id: activeProjectId })
                    : t("targetGroupsAdmin.selectProject")}
              </MsqdxTypography>
              <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                {t("targetGroupsAdmin.localeFieldHint")}
              </MsqdxTypography>
              <MsqdxFormField
                label={t("targetGroupsAdmin.name")}
                value={locale === "de" ? createForm.name_de : createForm.name}
                onChange={(e) =>
                  setCreateForm((prev) =>
                    locale === "de" ? { ...prev, name_de: e.target.value } : { ...prev, name: e.target.value }
                  )
                }
                placeholder={t("targetGroupsAdmin.namePlaceholder")}
                size="small"
                autoFocus
                fullWidth
              />
              <MsqdxFormField
                label={t("targetGroupsAdmin.segment")}
                value={locale === "de" ? createForm.segment_de : createForm.segment}
                onChange={(e) =>
                  setCreateForm((prev) =>
                    locale === "de" ? { ...prev, segment_de: e.target.value } : { ...prev, segment: e.target.value }
                  )
                }
                placeholder={t("targetGroupsAdmin.segmentPlaceholder")}
                size="small"
                fullWidth
              />
              <MsqdxTextareaField
                label={t("targetGroupsAdmin.description")}
                value={locale === "de" ? createForm.description_de : createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) =>
                    locale === "de"
                      ? { ...prev, description_de: e.target.value }
                      : { ...prev, description: e.target.value }
                  )
                }
                placeholder={t("targetGroupsAdmin.descriptionPlaceholder")}
                minRows={3}
                fullWidth
              />
              {createError && (
                <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                  {createError}
                </MsqdxTypography>
              )}
            </Stack>
          </MsqdxMoleculeCard>
        )}

        {/* Target group cards */}
        {items.map((tg) => (
          <MsqdxMoleculeCard
            key={tg.id}
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={() => router.push(ADMIN_ROUTES.targetGroupDetail(tg.id))}
            title={tg.name}
            titleVariant="h6"
            subtitle={tg.segment}
            sx={{
              minHeight: 140,
              border: "1px solid",
              borderColor: accent,
              "&:hover": { borderColor: accent },
              "& .MuiTypography-h6": { color: accent },
            }}
          />
        ))}
      </Box>

      <Dialog
        open={aiDialogOpen}
        onClose={() => !aiCreating && setAiDialogOpen(false)}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            width: "min(1200px, 96vw)",
            borderRadius: "var(--msqdx-radius-3xl)",
          },
        }}
      >
        <DialogTitle>{t("targetGroupsAdmin.generateWithAiTitle")}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
            {t("targetGroupsAdmin.generateWithAiIntro")}
          </MsqdxTypography>
          {aiLoading ? (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              {t("targetGroupsAdmin.generateWithAiLoading")}
            </MsqdxTypography>
          ) : aiSuggestions.length === 0 ? (
            <Stack spacing={1.5}>
              <MsqdxTypography variant="body2" sx={{ color: "warning.main" }}>
                {t("targetGroupsAdmin.generateWithAiEmpty")}
              </MsqdxTypography>
              {activeProjectId ? (
                <MsqdxButton
                  variant="outlined"
                  size="small"
                  type="button"
                  onClick={() => {
                    setAiDialogOpen(false);
                    router.push(`${ADMIN_ROUTES.projectDetail(activeProjectId)}#company-context`);
                  }}
                  startIcon={<MsqdxIcon name="open_in_new" customSize={16} />}
                  sx={{
                    alignSelf: "flex-start",
                    borderColor: accent,
                    color: accent,
                    "&:hover": { borderColor: accent, backgroundColor: "transparent" },
                  }}
                >
                  {t("targetGroupsAdmin.generateWithAiGoToProject")}
                </MsqdxButton>
              ) : null}
            </Stack>
          ) : (
            <>
              <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                {t("targetGroupsAdmin.generateWithAiSelectHint")}
              </MsqdxTypography>
              <Stack spacing={1}>
                {aiSuggestions.map((s, index) => (
                  <Box
                    key={`${s.segment}-${index}`}
                    sx={{
                      border: "1px solid",
                      borderColor: "var(--color-secondary-dx-grey-light-tint)",
                      borderRadius: "var(--msqdx-radius-3xl)",
                      p: 1.5,
                      bgcolor: "background.paper",
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Box
                        sx={{
                          mt: 0.1,
                          // Use DS checkbox visuals, but hide the group label and option label.
                          "& .MuiInputLabel-root": { display: "none" },
                          "& .MuiFormControlLabel-label": { display: "none" },
                          "& .MuiFormControlLabel-root": { m: 0 },
                          // Make the checkbox icon more prominent in the suggestion list.
                          "& .MuiCheckbox-root": { p: 0.25 },
                          "& .MuiSvgIcon-root": { fontSize: 26 },
                        }}
                      >
                        <MsqdxCheckboxField
                          label=" "
                          options={[{ value: "on", label: " ", disabled: aiCreating }]}
                          row
                          value={selectedAiIndices.has(index) ? ["on"] : []}
                          onChange={() => {
                            if (aiCreating) return;
                            toggleAiIndex(index);
                          }}
                        />
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          {/* Left: big scores */}
                          <Stack direction="row" spacing={1.25} alignItems="stretch" sx={{ flexShrink: 0 }}>
                            <Box
                              sx={{
                                minWidth: 86,
                                px: 1,
                                py: 0.75,
                                textAlign: "center",
                              }}
                            >
                              <MsqdxTypography
                                variant="h6"
                                weight="semibold"
                                sx={{ lineHeight: 1.1, fontFamily: MSQDX_TYPOGRAPHY.fontFamily.mono }}
                              >
                                {typeof (s as any).relevance_score_deterministic === "number"
                                  ? `${Math.max(0, Math.min(100, Number((s as any).relevance_score_deterministic)))}%`
                                  : "—"}
                              </MsqdxTypography>
                              <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                                {t("targetGroupsAdmin.relevanceDet") ?? "Relevance (deterministic)"}
                              </MsqdxTypography>
                            </Box>

                            <Box
                              sx={{
                                minWidth: 86,
                                px: 1,
                                py: 0.75,
                                textAlign: "center",
                              }}
                            >
                              <MsqdxTypography
                                variant="h6"
                                weight="semibold"
                                sx={{ lineHeight: 1.1, fontFamily: MSQDX_TYPOGRAPHY.fontFamily.mono }}
                              >
                                {typeof (s as any).relevance_score === "number"
                                  ? `${Math.max(0, Math.min(100, Number((s as any).relevance_score)))}%`
                                  : "—"}
                              </MsqdxTypography>
                              <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                                {t("targetGroupsAdmin.relevanceLlm") ?? "Relevance (AI)"}
                              </MsqdxTypography>
                            </Box>
                          </Stack>

                          {/* Right: headline + segment + description */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 0.25 }}>
                              {locale === "de" && (s.name_de || "").trim() ? s.name_de : s.name}
                            </MsqdxTypography>
                            <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                              {(locale === "de" && (s.segment_de || "").trim() ? s.segment_de : s.segment) || "—"}
                            </MsqdxTypography>
                            <MsqdxTypography variant="body2" sx={{ mt: 0.75, color: "text.primary" }}>
                              {(locale === "de" && (s.description_de || "").trim() ? s.description_de : s.description) || "—"}
                            </MsqdxTypography>

                            {/* Details toggle: hide CHECKION/research signals until expanded */}
                            {Array.isArray((s as any).relevance_signals) && (s as any).relevance_signals.length ? (
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, flexWrap: "wrap" }}>
                                <MsqdxButton
                                  variant="outlined"
                                  size="small"
                                  onClick={() => toggleAiDetails(index)}
                                  sx={{
                                    minWidth: 0,
                                    px: 1,
                                    borderColor: "var(--color-theme-accent)",
                                    color: "var(--color-theme-accent)",
                                    "&:hover": { borderColor: "var(--color-theme-accent)", bgcolor: "var(--color-theme-accent-tint)" },
                                  }}
                                >
                                  {expandedAiDetails.has(index)
                                    ? (t("targetGroupsAdmin.relevanceDetailsHide") ?? "Hide details")
                                    : (t("targetGroupsAdmin.relevanceDetailsShow") ?? "Show details")}
                                </MsqdxButton>
                                {expandedAiDetails.has(index) ? (
                                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", width: "100%" }}>
                                    {String(((s as any).relevance_signals as string[]).slice(0, 8).join(" · "))}
                                  </MsqdxTypography>
                                ) : null}
                              </Stack>
                            ) : null}

                            {expandedAiDetails.has(index) &&
                            typeof (s as any).relevance_reason === "string" &&
                            String((s as any).relevance_reason).trim() ? (
                              <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                                {String((s as any).relevance_reason).trim()}
                              </MsqdxTypography>
                            ) : null}
                          </Box>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </>
          )}
          {aiError ? (
            <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
              {aiError}
            </MsqdxTypography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <MsqdxButton variant="outlined" size="small" onClick={() => setAiDialogOpen(false)} disabled={aiCreating}>
            {t("common.cancel")}
          </MsqdxButton>
          <MsqdxButton
            variant="contained"
            size="small"
            brandColor="green"
            onClick={() => void handleCreateSelectedSuggestions()}
            disabled={aiCreating || aiLoading || aiSuggestions.length === 0 || selectedAiIndices.size === 0}
            startIcon={<MsqdxIcon name="auto_awesome" customSize={16} />}
          >
            {aiCreating ? t("targetGroupsAdmin.generateWithAiCreating") : t("targetGroupsAdmin.generateWithAiSubmit")}
          </MsqdxButton>
        </DialogActions>
      </Dialog>

      {(loading || loadError || (!activeProjectId && !items.length)) && (
        <Box sx={{ mt: 2 }}>
          {loading && (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              {t("targetGroupsAdmin.loading")}
            </MsqdxTypography>
          )}
          {loadError && (
            <MsqdxTypography variant="body2" sx={{ color: "error.main" }}>
              {loadError}
            </MsqdxTypography>
          )}
          {!activeProjectId && (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              {t("targetGroupsAdmin.selectProject")}
            </MsqdxTypography>
          )}
        </Box>
      )}
    </Box>
  );
}

