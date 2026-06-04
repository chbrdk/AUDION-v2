"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import type { PersonaListItem } from "@msqdx-glass/types";
import {
  MsqdxAvatar,
  MsqdxButton,
  MsqdxFormField,
  MsqdxIcon,
  MsqdxMoleculeCard,
  MsqdxTextareaField,
  MsqdxTypography,
} from "@msqdx/react";
import type { TargetGroupPersonaGenerateRequest } from "../../app/api/_lib/target-group";
import { extractPersonaId } from "../../lib/persona-extract-id";
import {
  personaListKeyTagVariant,
  pickPersonaListKeyTags,
} from "../../lib/persona-list-key-tags";
import {
  readPersonasOverviewViewModeFromStorage,
  writePersonasOverviewViewModeToStorage,
  type PersonasOverviewViewMode,
} from "../../lib/personas-overview-view-mode";
import { safePersonaAvatarSrc } from "../../lib/persona-avatar-src";
import { FORM_FIELD_ACCENT_SX } from "../../lib/theme-accent";
import {
  TG_V2_ACCENT,
  TG_V2_SURFACE_CLASS,
  tgV2CardSurfaceSx,
  tgV2CreateSurfaceSx,
  tgV2ListRowSurfaceSx,
  tgV2MediaBandSx,
} from "../../lib/target-group-v2-surface-styles";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassPersonaChip } from "../msqdx/chip/msqdx-glass-persona-chip";
import { PersonasOverviewLayoutToggle } from "../personas/personas-overview-layout-toggle";

export type MsqdxGlassTargetGroupPersonasPanelProps = {
  targetGroupId: string;
  targetGroupName: string;
  targetGroupSegment: string;
  personas: PersonaListItem[];
  generatePending: boolean;
  getPersonaDetailHref: (personaId: string) => string;
  onGenerate: (request: TargetGroupPersonaGenerateRequest) => Promise<unknown>;
  onDelete: (personaId: string) => Promise<void>;
};

type PersonaFormState = {
  segment: string;
  description: string;
};

const defaultForm: PersonaFormState = {
  segment: "",
  description: "",
};

export function MsqdxGlassTargetGroupPersonasPanel({
  targetGroupId,
  targetGroupName,
  targetGroupSegment,
  personas,
  generatePending,
  getPersonaDetailHref,
  onGenerate,
  onDelete,
}: MsqdxGlassTargetGroupPersonasPanelProps) {
  const { t } = useI18n();
  const router = useRouter();
  const accent = "var(--color-theme-accent)";

  const [layout, setLayout] = useState<PersonasOverviewViewMode>("cards");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<PersonaFormState>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiSegment, setAiSegment] = useState("");
  const [aiUserBrief, setAiUserBrief] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    const saved = readPersonasOverviewViewModeFromStorage();
    if (saved) setLayout(saved);
  }, []);

  useEffect(() => {
    writePersonasOverviewViewModeToStorage(layout);
  }, [layout]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      segment: prev.segment || targetGroupSegment || "",
    }));
  }, [targetGroupSegment, targetGroupId]);

  const isListLayout = layout === "list";

  const listRowSx = {
    ...tgV2ListRowSurfaceSx(),
    "&:focus-visible": {
      outline: `2px solid ${TG_V2_ACCENT}`,
      outlineOffset: 2,
    },
  };

  const buildGenerateRequest = (segment: string, userBrief: string): TargetGroupPersonaGenerateRequest => {
    const segmentLabel = (segment.trim() || targetGroupSegment || "Persona").trim();
    const descriptionParts: string[] = [];
    if (userBrief.trim()) {
      descriptionParts.push(userBrief.trim());
    }
    if (segment.trim() && segment.trim() !== targetGroupSegment.trim()) {
      descriptionParts.push(`Segment / archetype label: ${segment.trim()}`);
    }
    return {
      segment: segmentLabel || "Generated persona",
      description: descriptionParts.length > 0 ? descriptionParts.join("\n\n") : undefined,
      filterMode: "auto",
      variationParams: {
        randomize_chunks: true,
        temperature_mode: "random",
        randomize_prompt: true,
        chunk_sample_size: 40,
      },
    };
  };

  const runGenerate = async (segment: string, userBrief: string) => {
    setFormError(null);
    setAiError(null);
    const created = await onGenerate(buildGenerateRequest(segment, userBrief));
    const newId = extractPersonaId(created);
    setShowCreate(false);
    setAiDialogOpen(false);
    setForm(defaultForm);
    setAiUserBrief("");
    if (newId) {
      router.push(getPersonaDetailHref(newId));
    }
  };

  const handleInlineGenerate = async () => {
    if (!form.segment.trim()) {
      setFormError(t("targetGroupsAdmin.toasts.segmentRequired"));
      return;
    }
    try {
      await runGenerate(form.segment, form.description);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("targetGroupsAdmin.toasts.personaCreateError"));
    }
  };

  const handleAiGenerate = async () => {
    if (!aiSegment.trim() && !targetGroupSegment.trim()) {
      setAiError(t("targetGroupsAdmin.toasts.segmentRequired"));
      return;
    }
    try {
      await runGenerate(aiSegment, aiUserBrief);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t("personaAdmin.generateWithAiFailed"));
    }
  };

  const openAiDialog = () => {
    setAiError(null);
    setAiSegment(form.segment.trim() || targetGroupSegment || "");
    setAiUserBrief(form.description.trim());
    setAiDialogOpen(true);
  };

  const renderCreateTile = () => {
    if (!showCreate) {
      if (isListLayout) {
        return (
          <Box
            className={`msqdx-glass-personas-list__row msqdx-glass-personas-list__row--create ${TG_V2_SURFACE_CLASS.listRow} ${TG_V2_SURFACE_CLASS.create}`}
            role="button"
            tabIndex={0}
            onClick={() => setShowCreate(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowCreate(true);
              }
            }}
            sx={tgV2ListRowSurfaceSx(56)}
          >
            <MsqdxIcon name="add" customSize={22} style={{ color: accent, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <MsqdxTypography variant="subtitle1" weight="semibold" sx={{ color: accent }}>
                {t("targetGroupV2.personas.newPersona")}
              </MsqdxTypography>
              <MsqdxTypography variant="caption" color="text.secondary">
                {t("targetGroupV2.personas.newPersonaHint")}
              </MsqdxTypography>
            </Box>
            <Tooltip title={t("personaAdmin.generateWithAi")}>
              <IconButton
                size="small"
                aria-label={t("personaAdmin.generateWithAi")}
                onClick={(e) => {
                  e.stopPropagation();
                  openAiDialog();
                }}
                disabled={generatePending}
                sx={{ color: accent }}
              >
                <MsqdxIcon name="auto_awesome" customSize={22} />
              </IconButton>
            </Tooltip>
          </Box>
        );
      }

      return (
        <MsqdxMoleculeCard
          className={TG_V2_SURFACE_CLASS.create}
          variant="flat"
          borderRadius="button"
          clickable
          hoverable
          onClick={() => setShowCreate(true)}
          title={t("targetGroupV2.personas.newPersona")}
          titleVariant="h6"
          subtitle={t("targetGroupV2.personas.newPersonaHint")}
          headerActions={
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Tooltip title={t("personaAdmin.generateWithAi")}>
                <IconButton
                  size="small"
                  aria-label={t("personaAdmin.generateWithAi")}
                  onClick={(e) => {
                    e.stopPropagation();
                    openAiDialog();
                  }}
                  disabled={generatePending}
                  sx={{ color: accent }}
                >
                  <MsqdxIcon name="auto_awesome" customSize={22} />
                </IconButton>
              </Tooltip>
              <MsqdxIcon name="add" customSize={22} style={{ color: accent }} />
            </Stack>
          }
          sx={tgV2CreateSurfaceSx()}
        />
      );
    }

    return (
      <MsqdxMoleculeCard
        className={TG_V2_SURFACE_CLASS.card}
        variant="flat"
        borderRadius="button"
        title={t("targetGroupV2.personas.generateTitle")}
        titleVariant="h6"
        sx={{
          ...tgV2CardSurfaceSx(),
          gridColumn: isListLayout ? undefined : { xs: "1 / -1", sm: "1 / -1" },
        }}
        actions={
          <>
            <MsqdxButton
              variant="outlined"
              size="small"
              type="button"
              onClick={() => {
                setShowCreate(false);
                setForm(defaultForm);
                setFormError(null);
              }}
              disabled={generatePending}
            >
              {t("common.cancel")}
            </MsqdxButton>
            <MsqdxButton
              variant="contained"
              size="small"
              type="button"
              brandColor="green"
              onClick={() => void handleInlineGenerate()}
              disabled={generatePending || !form.segment.trim()}
              startIcon={
                <MsqdxIcon
                  name={generatePending ? "hourglass_empty" : "auto_awesome"}
                  customSize={16}
                />
              }
            >
              {generatePending
                ? t("personaAdmin.generateWithAiGenerating")
                : t("personaAdmin.generateWithAiSubmit")}
            </MsqdxButton>
          </>
        }
      >
        <Stack spacing={1.5}>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
            {t("targetGroupV2.personas.generateIntro", { name: targetGroupName })}
          </MsqdxTypography>
          <MsqdxFormField
            label={t("targetGroupsAdmin.segmentName")}
            value={form.segment}
            onChange={(e) => setForm((prev) => ({ ...prev, segment: e.target.value }))}
            placeholder={t("targetGroupsAdmin.segmentPlaceholderPersona")}
            required
            disabled={generatePending}
            fullWidth
            size="small"
            sx={FORM_FIELD_ACCENT_SX}
          />
          <MsqdxTextareaField
            label={t("personaAdmin.generateWithAiUserBrief")}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={t("personaAdmin.generateWithAiUserBriefPlaceholder")}
            minRows={3}
            disabled={generatePending}
            fullWidth
            sx={FORM_FIELD_ACCENT_SX}
          />
          {formError ? (
            <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
              {formError}
            </MsqdxTypography>
          ) : null}
        </Stack>
      </MsqdxMoleculeCard>
    );
  };

  const renderPersonaActions = (persona: PersonaListItem) => (
    <Stack direction="row" alignItems="center" spacing={0.25} onClick={(e) => e.stopPropagation()}>
      <Link href={getPersonaDetailHref(persona.id)} style={{ textDecoration: "none" }}>
        <MsqdxButton
          variant="text"
          size="small"
          component="span"
          startIcon={<MsqdxIcon name="open_in_new" customSize={18} />}
          aria-label={t("personaAdmin.openPersona")}
        />
      </Link>
      <MsqdxButton
        variant="text"
        size="small"
        brandColor="pink"
        onClick={() => void onDelete(persona.id)}
        startIcon={<MsqdxIcon name="delete" customSize={18} />}
        aria-label={t("personaAdmin.deletePersona")}
      />
    </Stack>
  );

  return (
    <Box className="msqdx-glass-target-group-personas-panel" sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
        <PersonasOverviewLayoutToggle
          value={layout}
          onChange={setLayout}
          cardsLabel={t("targetGroupV2.personas.viewCards")}
          listLabel={t("targetGroupV2.personas.viewList")}
          groupLabel={t("targetGroupV2.personas.layoutToggleLabel")}
        />
      </Box>

      <Box
        className={
          isListLayout ? "msqdx-glass-personas-list" : "msqdx-glass-personas-grid"
        }
        sx={
          isListLayout
            ? { display: "flex", flexDirection: "column", gap: 1 }
            : {
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                },
                gap: 2,
                alignItems: "start",
              }
        }
      >
        {renderCreateTile()}

        {personas.map((persona) => {
          const avatarSrc = safePersonaAvatarSrc(persona.avatarUrl ?? persona.imageUrl, persona.id);
          const keyTags = pickPersonaListKeyTags(persona);
          const personaHref = getPersonaDetailHref(persona.id);

          const personaKeyTags = (
            <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.375 }}>
              {keyTags.map((tag, index) => (
                <MsqdxGlassPersonaChip
                  key={`${persona.id}-${tag}`}
                  label={tag}
                  variant={personaListKeyTagVariant(index)}
                />
              ))}
            </Stack>
          );

          if (isListLayout) {
            return (
              <Box
                key={persona.id}
                className={`msqdx-glass-personas-list__row ${TG_V2_SURFACE_CLASS.listRow}`}
                role="button"
                tabIndex={0}
                onClick={() => router.push(personaHref)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(personaHref);
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
                  {keyTags.length > 0 ? (
                    <Box sx={{ display: { xs: "block", sm: "none" }, mt: 0.5 }}>{personaKeyTags}</Box>
                  ) : null}
                </Box>
                {keyTags.length > 0 ? (
                  <Box sx={{ display: { xs: "none", sm: "flex" }, flexShrink: 0 }}>{personaKeyTags}</Box>
                ) : null}
                {renderPersonaActions(persona)}
              </Box>
            );
          }

          return (
            <MsqdxMoleculeCard
              key={persona.id}
              className={TG_V2_SURFACE_CLASS.card}
              variant="flat"
              borderRadius="button"
              clickable
              hoverable
              onClick={() => router.push(personaHref)}
              media={
                <Box className={TG_V2_SURFACE_CLASS.media} sx={tgV2MediaBandSx}>
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
              }
              title={persona.name}
              titleVariant="h6"
              chips={keyTags.length > 0 ? personaKeyTags : undefined}
              headerActions={renderPersonaActions(persona)}
              sx={tgV2CardSurfaceSx()}
            >
              <MsqdxTypography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                {persona.segment || "—"}
              </MsqdxTypography>
            </MsqdxMoleculeCard>
          );
        })}
      </Box>

      {personas.length === 0 && !showCreate ? (
        <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mt: 2 }}>
          {t("personaAdmin.emptyInTargetGroup")}
        </MsqdxTypography>
      ) : null}

      <Dialog
        open={aiDialogOpen}
        onClose={() => !generatePending && setAiDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("personaAdmin.generateWithAiTitle")}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
            {t("targetGroupV2.personas.generateDialogIntro", { name: targetGroupName })}
          </MsqdxTypography>
          <TextField
            label={t("personaAdmin.generateWithAiSegment")}
            helperText={t("personaAdmin.generateWithAiSegmentHint")}
            value={aiSegment}
            onChange={(e) => setAiSegment(e.target.value)}
            fullWidth
            size="small"
            disabled={generatePending}
          />
          <TextField
            label={t("personaAdmin.generateWithAiUserBrief")}
            placeholder={t("personaAdmin.generateWithAiUserBriefPlaceholder")}
            value={aiUserBrief}
            onChange={(e) => setAiUserBrief(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            disabled={generatePending}
          />
          {aiError ? (
            <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
              {aiError}
            </MsqdxTypography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <MsqdxButton
            variant="outlined"
            size="small"
            onClick={() => setAiDialogOpen(false)}
            disabled={generatePending}
          >
            {t("common.cancel")}
          </MsqdxButton>
          <MsqdxButton
            variant="contained"
            size="small"
            brandColor="green"
            onClick={() => void handleAiGenerate()}
            disabled={generatePending}
            startIcon={<MsqdxIcon name="auto_awesome" customSize={16} />}
          >
            {generatePending
              ? t("personaAdmin.generateWithAiGenerating")
              : t("personaAdmin.generateWithAiSubmit")}
          </MsqdxButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
