"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Stack } from "@mui/material";
import type { PersonaListResponse, PersonaResponse } from "@msqdx-glass/types";
import { MsqdxAvatar, MsqdxButton, MsqdxChip, MsqdxFormField, MsqdxIcon, MsqdxMoleculeCard, MsqdxTypography } from "@msqdx/react";
import { buildApiUrl } from "../../app/api/_lib/backend";
import { ADMIN_ROUTES } from "../../lib/routes";
import { safePersonaAvatarSrc } from "../../lib/persona-avatar";
import { useProject } from "../projects/project-provider";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassPersonasOverviewProps = {
  initialList: PersonaListResponse;
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

export function MsqdxGlassPersonasOverview({ initialList }: MsqdxGlassPersonasOverviewProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { activeProjectId, activeProject, projects } = useProject();
  const accent = "var(--color-theme-accent)";

  const [list, setList] = useState<PersonaListResponse>(initialList);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateFormState);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const items = useMemo(() => list.items ?? [], [list.items]);

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
      const payload = (await response.json()) as PersonaListResponse;
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
        router.push(ADMIN_ROUTES.personaDetail(newId));
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("personaAdmin.toasts.creationFailed"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box sx={{ width: "100%" }} className="msqdx-glass-personas-overview">
      <Box
        className="msqdx-glass-personas-grid"
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
        {/* Create Persona */}
        {!showCreate ? (
          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={() => setShowCreate(true)}
            title={t("personaAdmin.newPersona")}
            titleVariant="h6"
            subtitle={t("personaAdmin.namePlaceholder")}
            headerActions={<MsqdxIcon name="add" customSize={22} style={{ color: accent }} />}
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

        {/* Persona cards */}
        {items.map((persona) => {
          const personaProjectId = persona.projectId;
          const avatarSrc = safePersonaAvatarSrc(persona.avatarUrl ?? persona.imageUrl, persona.id);
          return (
          <MsqdxMoleculeCard
            key={persona.id}
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={() => router.push(ADMIN_ROUTES.personaDetail(persona.id))}
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
            subtitle={`${persona.segment}${persona.status ? ` · ${persona.status}` : ""}`}
            headerActions={(
              <Stack direction="row" spacing={1} alignItems="center">
                {personaProjectId && (
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
                )}
                <MsqdxIcon name="chevron_right" customSize={20} style={{ color: accent }} />
              </Stack>
            )}
            actions={(
              <MsqdxButton
                variant="outlined"
                size="small"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(ADMIN_ROUTES.personaDetail(persona.id));
                }}
                sx={{
                  borderColor: accent,
                  color: accent,
                  "&:hover": { borderColor: accent, backgroundColor: "transparent" },
                }}
              >
                {t("common.view")}
              </MsqdxButton>
            )}
            sx={{
              minHeight: 140,
              border: "1px solid",
              borderColor: accent,
              "&:hover": { borderColor: accent },
              "& .MuiTypography-h6": { color: accent },
            }}
          />
        );})}
      </Box>

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

