"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Stack } from "@mui/material";
import { MsqdxButton, MsqdxChip, MsqdxFormField, MsqdxIcon, MsqdxMoleculeCard, MsqdxSelect, MsqdxTextareaField, MsqdxTypography } from "@msqdx/react";
import type { JourneyResponse } from "../../app/api/_lib/journeys";
import { journeysApi } from "../../app/api/_lib/journeys";
import { ADMIN_ROUTES } from "../../lib/routes";
import { useProject } from "../projects/project-provider";
import { useI18n } from "../i18n/i18n-provider";

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
    <Box sx={{ width: "100%" }}>
      <Box
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
            headerActions={<MsqdxIcon name="chevron_right" customSize={20} style={{ color: accent }} />}
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
            actions={(
              <MsqdxButton
                variant="outlined"
                size="small"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(ADMIN_ROUTES.journeyDetail(journey.id));
                }}
                sx={{
                  borderColor: accent,
                  color: accent,
                  "&:hover": { borderColor: accent, backgroundColor: "transparent" },
                }}
              >
                {t("adminDashboard.view")}
              </MsqdxButton>
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
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}

