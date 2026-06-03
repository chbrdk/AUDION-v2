"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import type { PersonaListResponse, PersonaResponse } from "@msqdx-glass/types";
import { MsqdxAvatar, MsqdxButton, MsqdxChip, MsqdxFormField, MsqdxIcon, MsqdxMoleculeCard, MsqdxTypography } from "@msqdx/react";
import { buildApiUrl } from "../../app/api/_lib/backend";
import { ADMIN_ROUTES } from "../../lib/routes";
import { normalizePersonaListResponse } from "../../lib/persona-list-normalize";
import { safePersonaAvatarSrc } from "../../lib/persona-avatar";
import {
  personaListKeyTagVariant,
  pickPersonaListKeyTags,
} from "../../lib/persona-list-key-tags";
import { useProject } from "../projects/project-provider";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassPersonaChip } from "../msqdx/chip/msqdx-glass-persona-chip";
import { fetchTargetGroupList, generateTargetGroupPersona } from "../../app/api/_lib/target-group";
import type { PersonasOverviewViewMode } from "../../lib/personas-overview-view-mode";

export type MsqdxGlassPersonasOverviewProps = {
  initialList: PersonaListResponse;
  /** Override detail URL when opening a persona (e.g. personas-v2). */
  getPersonaDetailHref?: (personaId: string) => string;
  /** Card grid (default) or compact list rows. */
  layout?: PersonasOverviewViewMode;
};

type CreateFormState = {
  name: string;
  segment: string;
  headline: string;
};

const defaultCreateFormState: CreateFormState = {
  name: "",
  segment: "",
  headline: "",
};

function extractPersonaId(payload: unknown): string | null {
  const anyPayload = payload as any;
  return (
    anyPayload?.metadata?.personaId ??
    anyPayload?.metadata?.persona_id ??
    anyPayload?.profile?.id ??
    anyPayload?.id ??
    null
  );
}

export function MsqdxGlassPersonasOverview({
  initialList,
  getPersonaDetailHref,
  layout = "cards",
}: MsqdxGlassPersonasOverviewProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { activeProjectId, activeProject, projects } = useProject();
  const accent = "var(--color-theme-accent)";

  const [list, setList] = useState<PersonaListResponse>(() => normalizePersonaListResponse(initialList));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateFormState);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTargetGroups, setAiTargetGroups] = useState<Array<{ id: string; name: string; segment: string }>>([]);
  const [aiTargetGroupId, setAiTargetGroupId] = useState("");
  const [aiSegment, setAiSegment] = useState("");
  const [aiUserBrief, setAiUserBrief] = useState("");
  const [aiLoadingList, setAiLoadingList] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const items = useMemo(() => list.items ?? [], [list.items]);

  const personaHref = (personaId: string) =>
    getPersonaDetailHref?.(personaId) ?? ADMIN_ROUTES.personaDetail(personaId);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, p.name);
    }
    return map;
  }, [projects]);

  const formatProjectLabel = (projectId: string) => {
    const name = projectNameById.get(projectId);
    if (name) return name;
    return projectId.length > 10 ? `${projectId.slice(0, 8)}…` : projectId;
  };

  const refresh = async (projectId: string | null) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: "1", page_size: "50" });
      if (projectId) {
        params.set("project_id", projectId);
      }
      const response = await fetch(
        buildApiUrl(`/api/persona-admin?${params.toString()}`),
        { cache: "no-store" }
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail ? `${response.status}: ${detail}` : `Backend responded with ${response.status}`);
      }
      const payload = normalizePersonaListResponse(await response.json());
      setList(payload);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t("personaAdmin.loadListFailed"));
      setList({ items: [], total: 0, page: 1, page_size: 50 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(activeProjectId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const openAiDialog = async () => {
    setAiError(null);
    setAiDialogOpen(true);
    if (!activeProjectId) return;
    setAiLoadingList(true);
    try {
      const res = await fetchTargetGroupList(activeProjectId, 1, 100);
      const raw = res.items ?? [];
      setAiTargetGroups(
        raw.map((tg) => ({
          id: tg.id,
          name: tg.name,
          segment: tg.segment ?? "",
        }))
      );
      if (raw.length === 1) {
        setAiTargetGroupId(raw[0]!.id);
        setAiSegment((raw[0]!.segment ?? "").trim());
      } else {
        setAiTargetGroupId("");
        setAiSegment("");
      }
      setAiUserBrief("");
    } catch {
      setAiTargetGroups([]);
      setAiError(t("personaAdmin.loadListFailed"));
    } finally {
      setAiLoadingList(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!activeProjectId) {
      setAiError(t("personaAdmin.selectProject"));
      return;
    }
    if (!aiTargetGroupId) {
      setAiError(t("personaAdmin.generateWithAiTargetGroupRequired"));
      return;
    }
    setAiGenerating(true);
    setAiError(null);
    try {
      const segmentLabel = (aiSegment.trim() || aiTargetGroups.find((g) => g.id === aiTargetGroupId)?.segment || "Persona").trim();
      const descriptionParts: string[] = [];
      if (aiUserBrief.trim()) {
        descriptionParts.push(aiUserBrief.trim());
      }
      if (aiSegment.trim()) {
        descriptionParts.push(`Segment / archetype label: ${aiSegment.trim()}`);
      }
      const description = descriptionParts.length > 0 ? descriptionParts.join("\n\n") : undefined;

      const created = await generateTargetGroupPersona(aiTargetGroupId, {
        segment: segmentLabel || "Generated persona",
        description,
        filterMode: "auto",
        limitChunks: 50,
        // Omit output_locale: persona-api defaults to English in `profile` and fills `profile_de` via translate (bilingual).
      });
      const newId = extractPersonaId(created);
      setAiDialogOpen(false);
      setAiUserBrief("");
      await refresh(activeProjectId);
      if (newId) {
        router.push(personaHref(newId));
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t("personaAdmin.generateWithAiFailed"));
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreate = async () => {
    const name = createForm.name.trim();
    if (!activeProjectId || !name) {
      setCreateError(t("personaAdmin.toasts.projectNameRequired"));
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const segment = (createForm.segment || "unspecified").trim() || "unspecified";
      const headline = (createForm.headline || t("personaAdmin.newPersona")).trim() || t("personaAdmin.newPersona");

      const payload = {
        project_id: activeProjectId,
        name,
        segment,
        headline,
        profile: {
          id: "",
          name,
          segment,
          headline,
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail ? `${response.status}: ${detail}` : `Backend responded with ${response.status}`);
      }

      const created = (await response.json()) as PersonaResponse;
      const newId = extractPersonaId(created);
      setCreateForm(defaultCreateFormState);
      setShowCreate(false);
      await refresh(activeProjectId);
      if (newId) {
        router.push(personaHref(newId));
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("personaAdmin.toasts.creationFailed"));
    } finally {
      setCreating(false);
    }
  };

  const isListLayout = layout === "list";

  const listRowSx = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    px: 2,
    py: 1.25,
    borderRadius: "var(--msqdx-radius-button, 12px)",
    border: "1px solid",
    borderColor: accent,
    cursor: "pointer",
    transition: "border-color 0.15s ease, background-color 0.15s ease",
    "&:hover": {
      borderColor: accent,
      bgcolor: "rgba(0, 0, 0, 0.02)",
    },
    "&:focus-visible": {
      outline: `2px solid ${accent}`,
      outlineOffset: 2,
    },
  } as const;

  return (
    <Box sx={{ width: "100%" }} className="msqdx-glass-personas-overview">
      <Box
        className={isListLayout ? "msqdx-glass-personas-list" : "msqdx-glass-personas-grid"}
        sx={
          isListLayout
            ? { display: "flex", flexDirection: "column", gap: 1 }
            : {
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  lg: "repeat(3, minmax(0, 1fr))",
                },
                gap: 2,
                alignItems: "start",
              }
        }
      >
        {/* Create Persona */}
        {!showCreate ? (
          isListLayout ? (
            <Box
              className="msqdx-glass-personas-list__row msqdx-glass-personas-list__row--create"
              role="button"
              tabIndex={0}
              onClick={() => setShowCreate(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setShowCreate(true);
                }
              }}
              sx={{
                ...listRowSx,
                borderStyle: "dashed",
                minHeight: 56,
              }}
            >
              <MsqdxIcon name="add" customSize={22} style={{ color: accent, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <MsqdxTypography variant="subtitle1" weight="semibold" sx={{ color: accent }}>
                  {t("personaAdmin.newPersona")}
                </MsqdxTypography>
                <MsqdxTypography variant="caption" color="text.secondary">
                  {t("personaAdmin.namePlaceholder")}
                </MsqdxTypography>
              </Box>
              <Tooltip title={t("personaAdmin.generateWithAi")}>
                <IconButton
                  size="small"
                  aria-label={t("personaAdmin.generateWithAi")}
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
            </Box>
          ) : (
          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={() => setShowCreate(true)}
            title={t("personaAdmin.newPersona")}
            titleVariant="h6"
            subtitle={t("personaAdmin.namePlaceholder")}
            headerActions={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Tooltip title={t("personaAdmin.generateWithAi")}>
                  <IconButton
                    size="small"
                    aria-label={t("personaAdmin.generateWithAi")}
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
            }
            sx={{
              minHeight: 140,
              border: "2px dashed",
              borderColor: accent,
              "& .MuiTypography-h6": { color: accent },
            }}
          />
          )
        ) : (
          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            title={t("personaAdmin.newPersona")}
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
                  {t("personaAdmin.create")}
                </MsqdxButton>
              </>
            )}
          >
            <Stack spacing={1.5}>
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
                size="small"
                autoFocus
                fullWidth
              />
              <MsqdxFormField
                label={t("personaAdmin.segment")}
                value={createForm.segment}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, segment: e.target.value }))}
                placeholder={t("personaAdmin.segmentPlaceholder")}
                size="small"
                fullWidth
              />
              <MsqdxFormField
                label={t("personaAdmin.headline")}
                value={createForm.headline}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, headline: e.target.value }))}
                placeholder={t("personaAdmin.headlinePlaceholder")}
                size="small"
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

        {/* Persona cards / list rows */}
        {items.map((persona) => {
          const personaProjectId = persona.projectId;
          const personaTgId = persona.targetGroupId ?? null;
          const showProjectChip =
            Boolean(personaProjectId) &&
            (!activeProjectId || String(personaProjectId) !== String(activeProjectId));
          const avatarSrc = safePersonaAvatarSrc(persona.avatarUrl ?? persona.imageUrl, persona.id);
          const keyTags = pickPersonaListKeyTags(persona);

          const personaChips = (
            <Stack direction="row" flexWrap="wrap" alignItems="center" sx={{ gap: 0.5 }}>
              {!personaTgId ? (
                <MsqdxChip
                  variant="outlined"
                  size="small"
                  label={t("personaAdmin.noTargetGroupBanner")}
                  sx={{
                    borderColor: "warning.main",
                    color: "warning.main",
                    height: 24,
                    "& .MuiChip-label": { color: "warning.main", fontSize: "0.7rem" },
                  }}
                />
              ) : null}
              {showProjectChip && personaProjectId ? (
                <MsqdxChip
                  variant="outlined"
                  size="small"
                  label={formatProjectLabel(personaProjectId)}
                  sx={{
                    borderColor: accent,
                    color: accent,
                    "& .MuiChip-label": { color: accent },
                  }}
                />
              ) : null}
              {keyTags.map((tag, index) => (
                <MsqdxGlassPersonaChip
                  key={`${persona.id}-${tag}`}
                  label={tag}
                  variant={personaListKeyTagVariant(index)}
                />
              ))}
            </Stack>
          );

          const personaKeyTagsInline =
            keyTags.length > 0 ? (
              <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.375, mt: 0.5 }}>
                {keyTags.map((tag, index) => (
                  <MsqdxGlassPersonaChip
                    key={`${persona.id}-inline-${tag}`}
                    label={tag}
                    variant={personaListKeyTagVariant(index)}
                  />
                ))}
              </Stack>
            ) : null;

          if (isListLayout) {
            return (
              <Box
                key={persona.id}
                className="msqdx-glass-personas-list__row"
                role="button"
                tabIndex={0}
                onClick={() => router.push(personaHref(persona.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(personaHref(persona.id));
                  }
                }}
                sx={listRowSx}
              >
                <MsqdxAvatar
                  size="md"
                  src={avatarSrc}
                  alt={persona.name}
                  fallback={(persona.name ?? "").trim() || "?"}
                  bordered
                  sx={{
                    flexShrink: 0,
                    borderColor: accent,
                    backgroundColor: accent,
                    color: "white",
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <MsqdxTypography variant="subtitle1" weight="semibold" sx={{ color: accent }}>
                    {persona.name}
                  </MsqdxTypography>
                  <MsqdxTypography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {persona.segment || "—"}
                  </MsqdxTypography>
                  <Box sx={{ display: { xs: "block", sm: "none" } }}>{personaKeyTagsInline}</Box>
                </Box>
                <Box sx={{ display: { xs: "none", sm: "flex" }, flexShrink: 0 }}>{personaChips}</Box>
                <MsqdxIcon name="chevron_right" customSize={22} style={{ color: accent, flexShrink: 0 }} />
              </Box>
            );
          }

          return (
          <MsqdxMoleculeCard
            key={persona.id}
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={() => router.push(personaHref(persona.id))}
            media={(
              <Box
                sx={{
                  height: 92,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "rgba(0, 0, 0, 0.03)",
                }}
              >
                <MsqdxAvatar
                  size="xl"
                  src={avatarSrc}
                  alt={persona.name}
                  fallback={(persona.name ?? "").trim() || "?"}
                  bordered
                  sx={{
                    borderColor: accent,
                    backgroundColor: accent,
                    color: "white",
                  }}
                />
              </Box>
            )}
            title={persona.name}
            titleVariant="h6"
            chips={personaChips}
            sx={{
              minHeight: 140,
              border: "1px solid",
              borderColor: accent,
              "&:hover": { borderColor: accent },
              "& .MuiTypography-h6": { color: accent },
            }}
          >
            <MsqdxTypography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {persona.segment || "—"}
            </MsqdxTypography>
          </MsqdxMoleculeCard>
        );})}
      </Box>

      <Dialog open={aiDialogOpen} onClose={() => !aiGenerating && setAiDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("personaAdmin.generateWithAiTitle")}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
            {t("personaAdmin.generateWithAiIntro")}
          </MsqdxTypography>
          {aiLoadingList ? (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              {t("personaAdmin.loading")}
            </MsqdxTypography>
          ) : aiTargetGroups.length === 0 ? (
            <MsqdxTypography variant="body2" sx={{ color: "warning.main" }}>
              {t("personaAdmin.generateWithAiNoTargetGroups")}
            </MsqdxTypography>
          ) : (
            <FormControl fullWidth size="small" required>
              <InputLabel id="ai-tg-label">{t("personaAdmin.generateWithAiTargetGroup")}</InputLabel>
              <Select
                labelId="ai-tg-label"
                label={t("personaAdmin.generateWithAiTargetGroup")}
                value={aiTargetGroupId}
                onChange={(e) => {
                  const id = String(e.target.value);
                  setAiTargetGroupId(id);
                  const tg = aiTargetGroups.find((g) => g.id === id);
                  if (tg?.segment) {
                    setAiSegment(tg.segment);
                  }
                }}
              >
                {aiTargetGroups.map((tg) => (
                  <MenuItem key={tg.id} value={tg.id}>
                    {tg.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            label={t("personaAdmin.generateWithAiSegment")}
            helperText={t("personaAdmin.generateWithAiSegmentHint")}
            value={aiSegment}
            onChange={(e) => setAiSegment(e.target.value)}
            fullWidth
            size="small"
            disabled={aiGenerating}
          />
          <TextField
            label={t("personaAdmin.generateWithAiUserBrief")}
            placeholder={t("personaAdmin.generateWithAiUserBriefPlaceholder")}
            value={aiUserBrief}
            onChange={(e) => setAiUserBrief(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            disabled={aiGenerating}
          />
          {aiError ? (
            <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
              {aiError}
            </MsqdxTypography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <MsqdxButton variant="outlined" size="small" onClick={() => setAiDialogOpen(false)} disabled={aiGenerating}>
            {t("common.cancel")}
          </MsqdxButton>
          <MsqdxButton
            variant="contained"
            size="small"
            brandColor="green"
            onClick={() => void handleAiGenerate()}
            disabled={aiGenerating || !aiTargetGroupId || aiTargetGroups.length === 0}
            startIcon={<MsqdxIcon name="auto_awesome" customSize={16} />}
          >
            {aiGenerating ? t("personaAdmin.generateWithAiGenerating") : t("personaAdmin.generateWithAiSubmit")}
          </MsqdxButton>
        </DialogActions>
      </Dialog>

      {(loading || loadError || (!activeProjectId && !items.length)) && (
        <Box sx={{ mt: 2 }}>
          {loading && (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              {t("personaAdmin.loading")}
            </MsqdxTypography>
          )}
          {loadError && (
            <MsqdxTypography variant="body2" sx={{ color: "error.main" }}>
              {loadError}
            </MsqdxTypography>
          )}
          {!activeProjectId && (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              {t("personaAdmin.selectProject")}
            </MsqdxTypography>
          )}
        </Box>
      )}
    </Box>
  );
}

