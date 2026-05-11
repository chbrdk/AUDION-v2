"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Stack } from "@mui/material";
import { MsqdxButton, MsqdxChip, MsqdxFormField, MsqdxIcon, MsqdxMoleculeCard, MsqdxSelect, MsqdxTextareaField, MsqdxTypography } from "@msqdx/react";
import type { JourneyResponse } from "../../app/api/_lib/journeys";
import type { PersonaListResponse } from "@msqdx-glass/types";
import { journeysApi } from "../../app/api/_lib/journeys";
import { buildApiUrl } from "../../app/api/_lib/backend";
import { ADMIN_ROUTES } from "../../lib/routes";
import { useProject } from "../projects/project-provider";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassConvertUxRunDialog } from "./msqdx-glass-convert-ux-run-dialog";

export type MsqdxGlassJourneysOverviewProps = {
  initialJourneys: JourneyResponse[];
};

const JOURNEY_TYPE_OPTIONS = [
  "customer_acquisition",
  "customer_onboarding",
  "customer_retention",
  "customer_support",
  "product_usage",
  "purchase_decision",
] as const;
type JourneyType = (typeof JOURNEY_TYPE_OPTIONS)[number];

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function MsqdxGlassJourneysOverview({ initialJourneys }: MsqdxGlassJourneysOverviewProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { activeProjectId } = useProject();
  const accent = "var(--color-theme-accent)";

  const [journeys, setJourneys] = useState<JourneyResponse[]>(initialJourneys);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createJourneyType, setCreateJourneyType] = useState<JourneyType>("customer_acquisition");
  const [createOrgId, setCreateOrgId] = useState<string>(() => generateUUID());
  const [previewPersonas, setPreviewPersonas] = useState<{ id: string; name: string }[]>([]);

  type UxRunPickerRow = {
    id: string;
    jobId: string;
    task?: string | null;
    siteUrl?: string | null;
    createdAt?: string;
    derivedJourneyId?: string | null;
  };
  const [createFromUxOpen, setCreateFromUxOpen] = useState(false);
  const [selectedPersonaIdForUx, setSelectedPersonaIdForUx] = useState<string | null>(null);
  const [uxRunsForPersona, setUxRunsForPersona] = useState<UxRunPickerRow[]>([]);
  const [loadingUxRuns, setLoadingUxRuns] = useState(false);
  const [convertRunOpen, setConvertRunOpen] = useState<UxRunPickerRow | null>(null);

  const refresh = async (projectId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await journeysApi.listJourneys({
        project_id: projectId ?? undefined,
        page: 1,
        page_size: 50,
      });
      setJourneys(Array.isArray(data) ? data : []);
    } catch (e) {
      setJourneys([]);
      setError(e instanceof Error ? e.message : t("journeys.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(activeProjectId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) {
      setPreviewPersonas([]);
      return;
    }
    const params = new URLSearchParams({ page: "1", page_size: "6", project_id: activeProjectId });
    void fetch(buildApiUrl(`/api/persona-admin?${params.toString()}`), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PersonaListResponse | null) => {
        const list = data?.items ?? [];
        setPreviewPersonas(list.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch(() => setPreviewPersonas([]));
  }, [activeProjectId]);

  useEffect(() => {
    if (!selectedPersonaIdForUx) {
      setUxRunsForPersona([]);
      return;
    }
    let cancelled = false;
    setLoadingUxRuns(true);
    void fetch(
      buildApiUrl(`/api/persona-admin/${encodeURIComponent(selectedPersonaIdForUx)}/ux-journey-runs`),
      { cache: "no-store" },
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: UxRunPickerRow[]) => {
        if (!cancelled) setUxRunsForPersona(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setUxRunsForPersona([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingUxRuns(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPersonaIdForUx]);

  const items = useMemo(() => journeys ?? [], [journeys]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!activeProjectId) {
      setCreateError(t("journeys.selectProject"));
      return;
    }
    if (!name) {
      setCreateError(t("journeys.new.errors.journeyNameRequired"));
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const journey = await journeysApi.createJourney({
        name,
        description: createDescription.trim() || undefined,
        journey_type: createJourneyType,
        creation_mode: "manual",
        organization_id: createOrgId.trim() || generateUUID(),
        project_id: activeProjectId,
      });
      setShowCreate(false);
      setCreateName("");
      setCreateDescription("");
      setCreateJourneyType("customer_acquisition");
      setCreateOrgId(generateUUID());
      await refresh(activeProjectId);
      router.push(ADMIN_ROUTES.journeyDetail(journey.id));
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("journeys.new.errors.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box sx={{ width: "100%" }} className="msqdx-glass-journeys-overview">
      <Box
        className="msqdx-glass-journeys-grid"
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
        {/* Create from UX-run */}
        {!createFromUxOpen ? (
          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={() => setCreateFromUxOpen(true)}
            title={t("journeys.convertFromUxRun.createFromUxRunTab")}
            titleVariant="h6"
            subtitle={t("journeys.convertFromUxRun.subtitle")}
            headerActions={<MsqdxIcon name="auto_awesome" customSize={22} style={{ color: accent }} />}
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
            title={t("journeys.convertFromUxRun.createFromUxRunTab")}
            titleVariant="h6"
            sx={{
              minHeight: 140,
              border: "1px solid",
              borderColor: accent,
              "& .MuiTypography-h6": { color: accent },
            }}
            actions={(
              <MsqdxButton
                variant="text"
                size="small"
                type="button"
                onClick={() => {
                  setCreateFromUxOpen(false);
                  setSelectedPersonaIdForUx(null);
                }}
                sx={{ color: accent }}
              >
                {t("common.cancel")}
              </MsqdxButton>
            )}
          >
            <Stack spacing={1.5}>
              <MsqdxSelect
                label={t("journeys.convertFromUxRun.selectPersona")}
                value={selectedPersonaIdForUx ?? ""}
                onChange={(event: any) => setSelectedPersonaIdForUx(event.target.value || null)}
                options={previewPersonas.map((p) => ({ value: p.id, label: p.name || p.id }))}
                size="small"
              />
              {selectedPersonaIdForUx && loadingUxRuns ? (
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                  {t("journeys.convertFromUxRun.loadingRuns")}
                </MsqdxTypography>
              ) : null}
              {selectedPersonaIdForUx && !loadingUxRuns && uxRunsForPersona.length === 0 ? (
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                  {t("journeys.convertFromUxRun.noRunsForPersona")}
                </MsqdxTypography>
              ) : null}
              {uxRunsForPersona.length > 0 ? (
                <Stack spacing={0.5}>
                  {uxRunsForPersona.map((row) => (
                    <Box
                      key={row.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 1,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <MsqdxTypography variant="body2" weight="medium">
                          {row.task ? row.task.slice(0, 60) : row.jobId}
                        </MsqdxTypography>
                        {row.siteUrl ? (
                          <MsqdxTypography
                            variant="caption"
                            sx={{ color: "text.secondary", wordBreak: "break-all", display: "block" }}
                          >
                            {row.siteUrl}
                          </MsqdxTypography>
                        ) : null}
                      </Box>
                      {row.derivedJourneyId ? (
                        <MsqdxButton
                          variant="outlined"
                          size="small"
                          type="button"
                          onClick={() => router.push(ADMIN_ROUTES.journeyDetail(row.derivedJourneyId!))}
                          sx={{ borderColor: accent, color: accent }}
                        >
                          {t("personaAdmin.openDerivedJourney")}
                        </MsqdxButton>
                      ) : (
                        <MsqdxButton
                          variant="outlined"
                          size="small"
                          type="button"
                          onClick={() => setConvertRunOpen(row)}
                          sx={{ borderColor: accent, color: accent }}
                        >
                          {t("journeys.convertFromUxRun.cta")}
                        </MsqdxButton>
                      )}
                    </Box>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </MsqdxMoleculeCard>
        )}

        {/* Create Journey */}
        {!showCreate ? (
          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={() => setShowCreate(true)}
            title={t("journeys.create")}
            titleVariant="h6"
            subtitle={activeProjectId ? t("journeys.title") : t("journeys.selectProject")}
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
            title={t("journeys.create")}
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
                  {creating ? t("journeys.new.creating") : t("journeys.create")}
                </MsqdxButton>
                <MsqdxButton
                  variant="text"
                  size="small"
                  type="button"
                  onClick={() => router.push(ADMIN_ROUTES.journeyNew)}
                  sx={{ color: accent }}
                >
                  {t("adminDashboard.viewAll")}
                </MsqdxButton>
              </>
            )}
          >
            <Stack spacing={1.5}>
              <MsqdxFormField
                label={t("journeys.new.journeyName")}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={t("journeys.new.title")}
                size="small"
                fullWidth
                autoFocus
              />
              <MsqdxTextareaField
                label={t("journeys.new.description")}
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                minRows={3}
                fullWidth
              />
              <MsqdxSelect
                label={t("journeys.new.journeyType")}
                value={createJourneyType}
                onChange={(event: any) => setCreateJourneyType(event.target.value as JourneyType)}
                options={JOURNEY_TYPE_OPTIONS.map((value) => ({
                  value,
                  label: t(`journeys.new.journeyTypes.${value}`),
                }))}
                size="small"
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "flex-end" }}>
                <Box sx={{ flex: 1 }}>
                  <MsqdxFormField
                    label={t("journeys.new.organizationId")}
                    value={createOrgId}
                    onChange={(e) => setCreateOrgId(e.target.value)}
                    placeholder={t("journeys.new.organizationPlaceholder")}
                    size="small"
                    fullWidth
                  />
                </Box>
                <MsqdxButton
                  variant="outlined"
                  size="small"
                  type="button"
                  onClick={() => setCreateOrgId(generateUUID())}
                  sx={{
                    borderColor: accent,
                    color: accent,
                    "&:hover": { borderColor: accent, backgroundColor: "transparent" },
                  }}
                >
                  {t("journeys.new.generateOrgId")}
                </MsqdxButton>
              </Stack>
              {createError && (
                <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                  {createError}
                </MsqdxTypography>
              )}
              {!activeProjectId && (
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                  {t("journeys.selectProject")}
                </MsqdxTypography>
              )}
            </Stack>
          </MsqdxMoleculeCard>
        )}

        {/* Journey cards */}
        {items.map((journey) => (
          <MsqdxMoleculeCard
            key={journey.id}
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={() => router.push(ADMIN_ROUTES.journeyDetail(journey.id))}
            title={journey.name}
            titleVariant="h6"
            subtitle={journey.description || t("journeys.type", { type: journey.journey_type })}
            chips={(
              <>
                <MsqdxChip
                  variant="outlined"
                  size="small"
                  label={t("journeys.phases", { count: journey.phases?.length ?? 0 })}
                  sx={{ borderColor: accent, color: accent, "& .MuiChip-label": { color: accent } }}
                />
                <MsqdxChip
                  variant="outlined"
                  size="small"
                  label={t("journeys.type", { type: journey.journey_type })}
                  sx={{ borderColor: accent, color: accent, "& .MuiChip-label": { color: accent } }}
                />
              </>
            )}
            sx={{
              minHeight: 140,
              border: "1px solid",
              borderColor: accent,
              "&:hover": { borderColor: accent },
              "& .MuiTypography-h6": { color: accent },
            }}
          >
            {typeof journey.validation_score === "number" && (
              <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                {t("journeys.validation")}: <strong>{journey.validation_score.toFixed(1)}%</strong>
              </MsqdxTypography>
            )}
          </MsqdxMoleculeCard>
        ))}
      </Box>

      {(loading || error || (!items.length && !loading)) && (
        <Box sx={{ mt: 2 }}>
          {loading && (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              {t("journeys.loading")}
            </MsqdxTypography>
          )}
          {error && (
            <MsqdxTypography variant="body2" sx={{ color: "error.main" }}>
              {t("journeys.errorTitle")} {error}
            </MsqdxTypography>
          )}
          {!loading && !error && items.length === 0 && (
            <Stack spacing={1} sx={{ py: 1 }}>
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                {t("journeys.empty")}
              </MsqdxTypography>
              {previewPersonas.length > 0 && (
                <>
                  <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
                    {t("journeys.emptyPersonasIntro")}
                  </MsqdxTypography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {previewPersonas.map((p) => (
                      <MsqdxButton
                        key={p.id}
                        variant="outlined"
                        size="small"
                        type="button"
                        onClick={() => router.push(ADMIN_ROUTES.personaDetail(p.id))}
                        sx={{ borderColor: accent, color: accent }}
                      >
                        {p.name || t("journeys.openPersona")}
                      </MsqdxButton>
                    ))}
                  </Stack>
                </>
              )}
            </Stack>
          )}
        </Box>
      )}

      <MsqdxGlassConvertUxRunDialog
        open={Boolean(convertRunOpen)}
        onClose={() => setConvertRunOpen(null)}
        personaId={selectedPersonaIdForUx ?? null}
        runId={convertRunOpen?.id ?? null}
        jobId={convertRunOpen?.jobId ?? null}
        organizationId={createOrgId}
        projectId={activeProjectId ?? null}
        defaultName={
          convertRunOpen?.task ? `UX-Run: ${convertRunOpen.task.slice(0, 80)}` : undefined
        }
        alreadyConverted={Boolean(convertRunOpen?.derivedJourneyId)}
        derivedJourneyId={convertRunOpen?.derivedJourneyId ?? null}
        onSuccess={({ journeyId }) => {
          if (selectedPersonaIdForUx) {
            setUxRunsForPersona((rows) =>
              rows.map((r) => (r.id === convertRunOpen?.id ? { ...r, derivedJourneyId: journeyId } : r)),
            );
          }
          void refresh(activeProjectId ?? null);
          router.push(ADMIN_ROUTES.journeyDetail(journeyId));
        }}
      />
    </Box>
  );
}

