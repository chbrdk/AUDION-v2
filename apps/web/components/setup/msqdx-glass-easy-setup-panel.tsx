"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Box, Stack } from "@mui/material";
import { MsqdxButton, MsqdxFormField, MsqdxMoleculeCard, MsqdxTextareaField, MsqdxTypography } from "@msqdx/react";
import { buildApiUrl } from "../../app/api/_lib/backend";
import { withOutputLocale } from "../../lib/ai-output-locale";
import { API_ROUTES } from "../../lib/api-routes";
import { resolvePlatformCompanyIdForApi } from "../../lib/platform-company-context";
import { ADMIN_ROUTES } from "../../lib/routes";
import { useI18n } from "../i18n/i18n-provider";
import { useProject } from "../projects/project-provider";

export type ProjectEasySetupResponse = {
  project: { id: string; name: string };
  target_group: { id: string; name: string; segment: string };
  persona: { id: string; name: string; segment: string };
  website_excerpt_included: boolean;
};

export function MsqdxGlassEasySetupPanel() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const { refreshProjects, selectProject } = useProject();
  const accent = "var(--color-theme-accent)";

  const [customerName, setCustomerName] = useState("");
  const [about, setAbout] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProjectEasySetupResponse | null>(null);

  const parseError = async (response: Response) => {
    try {
      const data = await response.json();
      return data.detail || data.error || response.statusText || "Request failed";
    } catch {
      return response.statusText || "Request failed";
    }
  };

  const handleSubmit = async () => {
    const customer = customerName.trim();
    const brief = about.trim();
    if (!customer || !brief) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const base: Record<string, string> = {
        customer_name: customer,
        about: brief,
      };
      const url = websiteUrl.trim();
      if (url) base.website_url = url;
      const nameOverride = projectName.trim();
      if (nameOverride) base.project_name = nameOverride;

      const platformCompanyId = resolvePlatformCompanyIdForApi(searchParams);
      if (platformCompanyId) base.platform_company_id = platformCompanyId;

      const response = await fetch(buildApiUrl(API_ROUTES.projectsBootstrap), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withOutputLocale(base, locale)),
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = (await response.json()) as ProjectEasySetupResponse;
      setResult(data);
      await refreshProjects();
      selectProject(data.project.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("easySetup.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 720 }}>
      <MsqdxMoleculeCard
        variant="flat"
        borderRadius="button"
        title={t("easySetup.title")}
        titleVariant="h5"
        subtitle={t("easySetup.subtitle")}
        sx={{
          border: "1px solid",
          borderColor: accent,
          "& .MuiTypography-h5": { color: accent, fontWeight: 600 },
        }}
        actions={(
          <MsqdxButton
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || !customerName.trim() || !about.trim()}
            sx={{
              backgroundColor: `${accent} !important`,
              color: "white !important",
              "&:hover": { backgroundColor: `${accent} !important`, filter: "brightness(1.05)" },
            }}
          >
            {submitting ? t("easySetup.submitting") : t("easySetup.submit")}
          </MsqdxButton>
        )}
      >
        <Stack spacing={2}>
          <MsqdxTypography variant="body2" sx={{ opacity: 0.9 }}>
            {t("easySetup.websiteHint")}
          </MsqdxTypography>
          <MsqdxFormField
            label={t("easySetup.customerName")}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={t("easySetup.customerNamePlaceholder")}
            size="small"
            required
          />
          <MsqdxTextareaField
            label={t("easySetup.about")}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder={t("easySetup.aboutPlaceholder")}
            minRows={4}
            fullWidth
          />
          <MsqdxFormField
            label={t("easySetup.websiteUrl")}
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder={t("easySetup.websiteUrlPlaceholder")}
            size="small"
          />
          <MsqdxFormField
            label={t("easySetup.projectNameOptional")}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder={t("easySetup.projectNamePlaceholder")}
            size="small"
          />
          {error && (
            <MsqdxTypography variant="body2" sx={{ color: "error.main" }}>
              {error}
            </MsqdxTypography>
          )}
          {result && (
            <Box sx={{ pt: 1 }}>
              <MsqdxTypography variant="subtitle2" sx={{ mb: 1, color: accent }}>
                {t("easySetup.doneTitle")}
              </MsqdxTypography>
              <Stack spacing={0.5}>
                <MsqdxTypography variant="body2">
                  {t("easySetup.createdProject", { name: result.project.name })}
                </MsqdxTypography>
                <MsqdxTypography variant="body2">
                  {t("easySetup.createdTargetGroup", { name: result.target_group.name })}
                </MsqdxTypography>
                <MsqdxTypography variant="body2">
                  {t("easySetup.createdPersona", { name: result.persona.name })}
                </MsqdxTypography>
                {result.website_excerpt_included ? (
                  <MsqdxTypography variant="caption" sx={{ opacity: 0.85 }}>
                    {t("easySetup.websiteIncluded")}
                  </MsqdxTypography>
                ) : null}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}>
                <Link href={ADMIN_ROUTES.projectDetail(result.project.id)} style={{ textDecoration: "none" }}>
                  <MsqdxButton variant="outlined" size="small" sx={{ borderColor: accent, color: accent }}>
                    {t("easySetup.openProject")}
                  </MsqdxButton>
                </Link>
                <Link href={ADMIN_ROUTES.targetGroupDetail(result.target_group.id)} style={{ textDecoration: "none" }}>
                  <MsqdxButton variant="outlined" size="small" sx={{ borderColor: accent, color: accent }}>
                    {t("easySetup.openTargetGroup")}
                  </MsqdxButton>
                </Link>
                <Link href={ADMIN_ROUTES.personaDetail(result.persona.id)} style={{ textDecoration: "none" }}>
                  <MsqdxButton variant="outlined" size="small" sx={{ borderColor: accent, color: accent }}>
                    {t("easySetup.openPersona")}
                  </MsqdxButton>
                </Link>
                <Link href={ADMIN_ROUTES.dashboard} style={{ textDecoration: "none" }}>
                  <MsqdxButton variant="text" size="small" sx={{ color: accent }}>
                    {t("easySetup.backDashboard")}
                  </MsqdxButton>
                </Link>
              </Stack>
            </Box>
          )}
        </Stack>
      </MsqdxMoleculeCard>
    </Box>
  );
}
