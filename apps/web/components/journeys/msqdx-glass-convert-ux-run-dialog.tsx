"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
} from "@mui/material";
import { MsqdxButton, MsqdxFormField, MsqdxSelect, MsqdxTypography } from "@msqdx/react";

import { buildApiUrl } from "../../app/api/_lib/backend";
import { useI18n } from "../i18n/i18n-provider";

export type ConvertUxRunDialogProps = {
  open: boolean;
  onClose: () => void;
  personaId?: string | null;
  runId?: string | null;
  jobId?: string | null;
  organizationId: string;
  projectId?: string | null;
  defaultTargetGroupId?: string | null;
  defaultName?: string;
  /**
   * If true, the user has already converted this run previously. We surface
   * an "open existing" CTA and require an explicit force-toggle before
   * re-running the conversion.
   */
  alreadyConverted?: boolean;
  derivedJourneyId?: string | null;
  onSuccess?: (result: { journeyId: string; mode: string; fallbackUsed: boolean }) => void;
};

type ConvertResponse = {
  journey?: { id?: string };
  mode?: string;
  fallbackUsed?: boolean;
  alreadyConverted?: boolean;
};

type PreviewResponse = {
  draft?: {
    name?: string;
    description?: string;
    phases?: Array<{ name?: string; description?: string; expected_emotion?: string; elements?: unknown[] }>;
  };
  mode?: string;
  fallbackUsed?: boolean;
};

const JOURNEY_TYPES = ["ux_audit", "customer_onboarding", "purchase_decision", "product_usage", "customer_support"] as const;

type Mode = "ai" | "deterministic";

export function MsqdxGlassConvertUxRunDialog({
  open,
  onClose,
  personaId,
  runId,
  jobId,
  organizationId,
  projectId,
  defaultTargetGroupId,
  defaultName,
  alreadyConverted,
  derivedJourneyId,
  onSuccess,
}: ConvertUxRunDialogProps) {
  const { t, locale } = useI18n();
  const accent = "var(--color-theme-accent)";

  const [mode, setMode] = useState<Mode>("ai");
  const [journeyName, setJourneyName] = useState<string>(defaultName ?? "");
  const [journeyType, setJourneyType] = useState<string>("ux_audit");
  const [targetGroupId, setTargetGroupId] = useState<string>(defaultTargetGroupId ?? "");
  const [outputLocale, setOutputLocale] = useState<string>(locale === "de" ? "de" : "en");
  const [force, setForce] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse["draft"] | null>(null);
  const [previewMode, setPreviewMode] = useState<string | null>(null);
  const [previewFallback, setPreviewFallback] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setPreview(null);
      setPreviewMode(null);
      setPreviewFallback(false);
      setSubmitting(false);
      setPreviewing(false);
      setForce(false);
    }
  }, [open]);

  useEffect(() => {
    setOutputLocale(locale === "de" ? "de" : "en");
  }, [locale]);

  useEffect(() => {
    setJourneyName(defaultName ?? "");
  }, [defaultName]);

  useEffect(() => {
    setTargetGroupId(defaultTargetGroupId ?? "");
  }, [defaultTargetGroupId]);

  const buildBody = useCallback(() => {
    return {
      personaUxJourneyRunId: runId || undefined,
      jobId: jobId || undefined,
      personaId: personaId || undefined,
      mode,
      journeyName: journeyName.trim() || undefined,
      journeyType,
      targetGroupId: targetGroupId.trim() || undefined,
      projectId: projectId || undefined,
      organizationId,
      locale: outputLocale,
    };
  }, [runId, jobId, personaId, mode, journeyName, journeyType, targetGroupId, projectId, organizationId, outputLocale]);

  const handlePreview = useCallback(async () => {
    setPreviewing(true);
    setError(null);
    setPreview(null);
    setPreviewMode(null);
    setPreviewFallback(false);
    try {
      const res = await fetch(buildApiUrl("/api/journeys/from-ux-run/preview"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      if (!res.ok) {
        throw new Error(`Preview failed (${res.status})`);
      }
      const data = (await res.json()) as PreviewResponse;
      setPreview(data.draft ?? null);
      setPreviewMode(data.mode ?? mode);
      setPreviewFallback(Boolean(data.fallbackUsed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }, [buildBody, mode]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const qs = force ? "?force=true" : "";
      const res = await fetch(buildApiUrl(`/api/journeys/from-ux-run${qs}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      if (!res.ok) {
        throw new Error(`Conversion failed (${res.status})`);
      }
      const data = (await res.json()) as ConvertResponse;
      const newJourneyId = data.journey?.id;
      if (newJourneyId) {
        onSuccess?.({
          journeyId: newJourneyId,
          mode: data.mode ?? mode,
          fallbackUsed: Boolean(data.fallbackUsed),
        });
        onClose();
      } else {
        throw new Error("Conversion response did not include a journey id");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setSubmitting(false);
    }
  }, [buildBody, force, mode, onClose, onSuccess]);

  const typeOptions = useMemo(
    () => JOURNEY_TYPES.map((value) => ({ value, label: value })),
    [],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t("journeys.convertFromUxRun.title")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
            {t("journeys.convertFromUxRun.subtitle")}
          </MsqdxTypography>

          {alreadyConverted && derivedJourneyId && (
            <Alert
              severity="info"
              action={(
                <MsqdxButton
                  size="small"
                  variant="outlined"
                  type="button"
                  onClick={() => {
                    window.open(`/admin/journeys/${encodeURIComponent(derivedJourneyId)}`, "_self");
                  }}
                  sx={{ borderColor: accent, color: accent }}
                >
                  {t("journeys.convertFromUxRun.openExisting")}
                </MsqdxButton>
              )}
            >
              {t("journeys.convertFromUxRun.alreadyConverted")}
            </Alert>
          )}

          <Box>
            <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
              {t("journeys.convertFromUxRun.modeLabel")}
            </MsqdxTypography>
            <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <FormControlLabel
                value="ai"
                control={<Radio size="small" sx={{ color: accent, "&.Mui-checked": { color: accent } }} />}
                label={(
                  <Stack>
                    <span>{t("journeys.convertFromUxRun.modeAi")}</span>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                      {t("journeys.convertFromUxRun.modeAiHint")}
                    </MsqdxTypography>
                  </Stack>
                )}
              />
              <FormControlLabel
                value="deterministic"
                control={<Radio size="small" sx={{ color: accent, "&.Mui-checked": { color: accent } }} />}
                label={(
                  <Stack>
                    <span>{t("journeys.convertFromUxRun.modeDeterministic")}</span>
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                      {t("journeys.convertFromUxRun.modeDeterministicHint")}
                    </MsqdxTypography>
                  </Stack>
                )}
              />
            </RadioGroup>
          </Box>

          <MsqdxFormField
            label={t("journeys.convertFromUxRun.nameLabel")}
            value={journeyName}
            onChange={(e) => setJourneyName(e.target.value)}
            size="small"
            fullWidth
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Box sx={{ flex: 1 }}>
              <MsqdxSelect
                label={t("journeys.convertFromUxRun.typeLabel")}
                value={journeyType}
                onChange={(event: any) => setJourneyType(event.target.value as string)}
                options={typeOptions}
                size="small"
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <MsqdxSelect
                label={t("journeys.convertFromUxRun.localeLabel")}
                value={outputLocale}
                onChange={(event: any) => setOutputLocale(event.target.value as string)}
                options={[
                  { value: "en", label: t("journeys.convertFromUxRun.localeEn") },
                  { value: "de", label: t("journeys.convertFromUxRun.localeDe") },
                ]}
                size="small"
              />
            </Box>
          </Stack>

          <MsqdxFormField
            label={t("journeys.convertFromUxRun.targetGroupLabel")}
            value={targetGroupId}
            onChange={(e) => setTargetGroupId(e.target.value)}
            placeholder="target-group-uuid (optional)"
            size="small"
            fullWidth
          />

          {alreadyConverted && (
            <FormControlLabel
              control={(
                <Radio
                  checked={force}
                  onClick={() => setForce(!force)}
                  size="small"
                  sx={{ color: accent, "&.Mui-checked": { color: accent } }}
                />
              )}
              label={t("journeys.convertFromUxRun.force")}
            />
          )}

          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          {previewFallback && (
            <Alert severity="warning">{t("journeys.convertFromUxRun.fallbackUsed")}</Alert>
          )}

          {preview && (
            <Box
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: accent,
                borderRadius: 1,
                backgroundColor: "rgba(255,255,255,0.04)",
              }}
            >
              <MsqdxTypography variant="subtitle2">{preview.name}</MsqdxTypography>
              {preview.description && (
                <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                  {preview.description}
                </MsqdxTypography>
              )}
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {(preview.phases ?? []).map((phase, idx) => (
                  <Box key={`${phase.name}-${idx}`} sx={{ pl: 1, borderLeft: `2px solid ${accent}` }}>
                    <MsqdxTypography variant="body2">
                      <strong>{idx + 1}. {phase.name}</strong>{" "}
                      {phase.expected_emotion && (
                        <MsqdxTypography component="span" variant="caption" sx={{ color: "text.secondary" }}>
                          ({phase.expected_emotion})
                        </MsqdxTypography>
                      )}
                    </MsqdxTypography>
                    {phase.description && (
                      <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                        {phase.description}
                      </MsqdxTypography>
                    )}
                  </Box>
                ))}
              </Stack>
              <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
                {previewMode}{previewFallback ? " (fallback)" : ""}
              </MsqdxTypography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <MsqdxButton variant="text" type="button" onClick={onClose} disabled={submitting}>
          {t("common.cancel")}
        </MsqdxButton>
        <MsqdxButton
          variant="outlined"
          type="button"
          onClick={handlePreview}
          disabled={previewing || submitting}
          sx={{ borderColor: accent, color: accent }}
        >
          {previewing ? t("journeys.convertFromUxRun.previewing") : t("journeys.convertFromUxRun.preview")}
        </MsqdxButton>
        <MsqdxButton
          variant="contained"
          type="button"
          onClick={handleSubmit}
          disabled={submitting || (alreadyConverted && !force)}
          sx={{ backgroundColor: `${accent} !important`, color: "white !important" }}
        >
          {submitting ? t("personaAdmin.converting") : t("journeys.convertFromUxRun.cta")}
        </MsqdxButton>
      </DialogActions>
    </Dialog>
  );
}
