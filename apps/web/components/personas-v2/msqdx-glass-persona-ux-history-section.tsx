"use client";

import { Alert, Box, CircularProgress, Tooltip } from "@mui/material";
import Link from "next/link";
import { MsqdxButton, MsqdxChip, MsqdxIcon, MsqdxTypography } from "@msqdx/react";
import { API_ROUTES } from "../../lib/api-routes";
import { personaUxJourneyTaskPreview } from "../../lib/persona-ux-journey-task-preview";
import { ADMIN_ROUTES } from "../../lib/routes";
import { useI18n } from "../i18n/i18n-provider";

export type PersonaUxJourneyRun = {
  id: string;
  jobId: string;
  task?: string | null;
  siteUrl?: string | null;
  success?: boolean | null;
  stepsCount?: number | null;
  scorecard?: Record<string, unknown> | null;
  createdAt: string;
  derivedJourneyId?: string | null;
};

export type MsqdxGlassPersonaUxHistorySectionProps = {
  runs: PersonaUxJourneyRun[];
  loading: boolean;
  error: string | null;
  personaId: string | null;
  chatHref: string | null;
  onConvertRun: (run: PersonaUxJourneyRun) => void;
  formatDate: (iso: string) => string;
};

export function MsqdxGlassPersonaUxHistorySection({
  runs,
  loading,
  error,
  personaId,
  chatHref,
  onConvertRun,
  formatDate,
}: MsqdxGlassPersonaUxHistorySectionProps) {
  const { t } = useI18n();
  const runCount = runs.length;

  return (
    <Box
      component="section"
      className="msqdx-glass-ux-history-section"
      aria-labelledby="persona-ux-history-title"
    >
      <Box className="msqdx-glass-ux-history-atmosphere">
        <Box className="msqdx-glass-ux-history-atmosphere__inner">
          <Box className="msqdx-glass-ux-history-atmosphere__copy">
            <MsqdxTypography
              id="persona-ux-history-title"
              variant="h3"
              component="h2"
              className="msqdx-glass-ux-history-atmosphere__title"
            >
              {t("personaV2.uxHistory.atmosphereTitle")}
            </MsqdxTypography>
            <MsqdxTypography variant="body2" className="msqdx-glass-ux-history-atmosphere__lead">
              {t("personaV2.uxHistory.atmosphereLead")}
            </MsqdxTypography>
          </Box>
          <Box className="msqdx-glass-ux-history-atmosphere__toolbar">
            <Box className="msqdx-glass-ux-history-status">
              <MsqdxIcon name="travel_explore" customSize={18} aria-hidden />
              <MsqdxTypography variant="caption" className="msqdx-glass-ux-history-status__label">
                {loading
                  ? "…"
                  : runCount === 0
                    ? t("personaV2.uxHistory.runCountZero")
                    : t("personaV2.uxHistory.runCount", { count: runCount })}
              </MsqdxTypography>
            </Box>
            {chatHref ? (
              <MsqdxButton
                component={Link}
                href={chatHref}
                variant="contained"
                size="small"
                startIcon={<MsqdxIcon name="forum" customSize={16} />}
              >
                {t("personaV2.uxHistory.startInChat")}
              </MsqdxButton>
            ) : null}
            <MsqdxButton
              component={Link}
              href={ADMIN_ROUTES.uxJourneyAgent}
              variant="outlined"
              size="small"
              startIcon={<MsqdxIcon name="smart_toy" customSize={16} />}
            >
              {t("personaV2.uxHistory.openAgent")}
            </MsqdxButton>
          </Box>
        </Box>
      </Box>

      {error ? (
        <Alert severity="warning" sx={{ mt: "var(--msqdx-spacing-md)" }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Box className="msqdx-glass-ux-history-loading" role="status">
          <CircularProgress size={28} aria-label={t("personaAdmin.loading")} />
        </Box>
      ) : runCount === 0 ? (
        <Box className="msqdx-glass-ux-history-empty">
          <MsqdxIcon name="route" customSize={36} className="msqdx-glass-ux-history-empty__icon" aria-hidden />
          <MsqdxTypography variant="subtitle1" className="msqdx-glass-ux-history-empty__title">
            {t("personaV2.uxHistory.emptyTitle")}
          </MsqdxTypography>
          <MsqdxTypography variant="body2" className="msqdx-glass-ux-history-empty__body">
            {t("personaV2.uxHistory.emptyBody")}
          </MsqdxTypography>
          {chatHref ? (
            <MsqdxButton
              component={Link}
              href={chatHref}
              variant="contained"
              size="small"
              startIcon={<MsqdxIcon name="forum" customSize={16} />}
            >
              {t("personaV2.uxHistory.startInChat")}
            </MsqdxButton>
          ) : null}
        </Box>
      ) : (
        <ol className="msqdx-glass-ux-history-timeline" aria-label={t("personaAdmin.uxJourneyHistory")}>
          {runs.map((run) => {
            const preview = personaUxJourneyTaskPreview(run.task);
            const videoHref = API_ROUTES.uxJourneyAgentVideo(run.jobId);
            const journeyHref = run.derivedJourneyId
              ? ADMIN_ROUTES.journeyDetail(run.derivedJourneyId)
              : null;
            const statusClass =
              run.success === true
                ? "msqdx-glass-ux-run__status--ok"
                : run.success === false
                  ? "msqdx-glass-ux-run__status--fail"
                  : "msqdx-glass-ux-run__status--neutral";

            return (
              <li key={run.id} className="msqdx-glass-ux-run">
                <Box className="msqdx-glass-ux-run__rail" aria-hidden>
                  <span className="msqdx-glass-ux-run__dot" />
                </Box>
                <article className="msqdx-glass-ux-run__card">
                  <header className="msqdx-glass-ux-run__header">
                    <MsqdxTypography variant="caption" className="msqdx-glass-ux-run__date">
                      {formatDate(run.createdAt)}
                    </MsqdxTypography>
                    <Box className="msqdx-glass-ux-run__meta">
                      {typeof run.stepsCount === "number" ? (
                        <MsqdxChip
                          size="small"
                          variant="outlined"
                          label={t("personaAdmin.uxJourneyRunSteps", { count: run.stepsCount })}
                          className="msqdx-glass-ux-run__chip"
                        />
                      ) : null}
                      {run.success !== null && run.success !== undefined ? (
                        <MsqdxChip
                          size="small"
                          variant="outlined"
                          label={
                            run.success
                              ? t("personaAdmin.uxJourneyRunSuccess")
                              : t("personaAdmin.uxJourneyRunFailed")
                          }
                          className={`msqdx-glass-ux-run__chip ${statusClass}`}
                        />
                      ) : null}
                    </Box>
                  </header>

                  {preview ? (
                    <MsqdxTypography variant="body1" className="msqdx-glass-ux-run__task">
                      {preview}
                    </MsqdxTypography>
                  ) : (
                    <MsqdxTypography variant="body2" className="msqdx-glass-ux-run__task msqdx-glass-ux-run__task--muted">
                      {t("personaV2.uxHistory.noTaskLabel")}
                    </MsqdxTypography>
                  )}

                  <Box className="msqdx-glass-ux-run__context">
                    {run.siteUrl ? (
                      <MsqdxTypography variant="caption" className="msqdx-glass-ux-run__url" component="p">
                        {run.siteUrl}
                      </MsqdxTypography>
                    ) : null}
                    <MsqdxTypography variant="caption" className="msqdx-glass-ux-run__job">
                      {t("personaAdmin.uxJourneyRunJob")}: {run.jobId}
                    </MsqdxTypography>
                  </Box>

                  <footer className="msqdx-glass-ux-run__actions">
                    <Tooltip title={t("personaAdmin.uxJourneyRunVideo")}>
                      <span>
                        <MsqdxButton
                          component="a"
                          href={videoHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          variant="outlined"
                          startIcon={<MsqdxIcon name="movie" customSize={16} />}
                        >
                          {t("personaAdmin.uxJourneyRunVideo")}
                        </MsqdxButton>
                      </span>
                    </Tooltip>
                    {journeyHref ? (
                      <MsqdxButton
                        component={Link}
                        href={journeyHref}
                        size="small"
                        variant="outlined"
                        startIcon={<MsqdxIcon name="map" customSize={16} />}
                      >
                        {t("personaAdmin.openDerivedJourney")}
                      </MsqdxButton>
                    ) : (
                      <MsqdxButton
                        size="small"
                        variant="outlined"
                        startIcon={<MsqdxIcon name="auto_awesome" customSize={16} />}
                        onClick={() => onConvertRun(run)}
                        disabled={!personaId}
                      >
                        {t("personaAdmin.convertToJourney")}
                      </MsqdxButton>
                    )}
                  </footer>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </Box>
  );
}
