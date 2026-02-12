"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Stack } from "@mui/material";
import { MsqdxButton, MsqdxChip, MsqdxIcon, MsqdxMoleculeCard, MsqdxTypography } from "@msqdx/react";
import type { JourneyResponse } from "../../app/api/_lib/journeys";
import { journeysApi } from "../../app/api/_lib/journeys";
import { ADMIN_ROUTES } from "../../lib/routes";
import { useProject } from "../projects/project-provider";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassJourneysOverviewProps = {
  initialJourneys: JourneyResponse[];
};

export function MsqdxGlassJourneysOverview({ initialJourneys }: MsqdxGlassJourneysOverviewProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { activeProjectId } = useProject();
  const accent = "var(--color-theme-accent)";

  const [journeys, setJourneys] = useState<JourneyResponse[]>(initialJourneys);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <MsqdxMoleculeCard
          variant="flat"
          borderRadius="button"
          clickable
          hoverable
          onClick={() => router.push(ADMIN_ROUTES.journeyNew)}
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

