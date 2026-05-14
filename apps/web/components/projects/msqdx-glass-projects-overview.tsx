"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Box, Stack } from "@mui/material";
import { MsqdxButton, MsqdxChip, MsqdxFormField, MsqdxIcon, MsqdxMoleculeCard, MsqdxTypography } from "@msqdx/react";
import type { ProjectSummary } from "./project-provider";
import { useProject } from "./project-provider";
import { useAuth } from "../auth/auth-provider";
import { useI18n } from "../i18n/i18n-provider";
import { ADMIN_ROUTES } from "../../lib/routes";
import { projectFederationChipKinds } from "../../lib/project-federation-badges";
import { resolvePlatformCompanyIdForApi } from "../../lib/platform-company-context";

export type MsqdxGlassProjectsOverviewProps = {
  initialProjects: ProjectSummary[];
};

export function MsqdxGlassProjectsOverview({ initialProjects }: MsqdxGlassProjectsOverviewProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { projects: providerProjects, createProject, refreshProjects, selectProject } = useProject();
  const accent = "var(--color-theme-accent)";

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedPlatformCompanyId = useMemo(() => resolvePlatformCompanyIdForApi(searchParams), [searchParams]);
  const showCentralPathHint = Boolean(user?.plexon_user_id?.trim()) && !resolvedPlatformCompanyId;

  const projects = useMemo(
    () => (providerProjects.length ? providerProjects : initialProjects),
    [providerProjects, initialProjects]
  );

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createProject(trimmed);
      await refreshProjects();
      selectProject(created.id);
      setName("");
      setShowCreate(false);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      if (raw.includes("platform_company_id")) {
        setError(t("settingsProjects.createProject.companyIdRequiredAfterApi"));
      } else {
        setError(raw || t("settingsProjects.errors.createProject"));
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ mb: 2 }}>
        <Link href={ADMIN_ROUTES.setup} style={{ textDecoration: "none" }}>
          <MsqdxButton
            variant="outlined"
            size="small"
            endIcon={<MsqdxIcon name="auto_awesome" customSize={16} />}
            sx={{
              borderColor: accent,
              color: accent,
              "&:hover": { borderColor: accent, backgroundColor: "transparent" },
            }}
          >
            {t("adminDashboard.easySetupCta")}
          </MsqdxButton>
        </Link>
      </Box>
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
        {/* Create Project */}
        {!showCreate ? (
          <Box className="msqdx-create-project-card" sx={{ minHeight: 140, display: "block" }}>
            <MsqdxMoleculeCard
              variant="flat"
              borderRadius="button"
              clickable
              hoverable
              onClick={() => setShowCreate(true)}
              title={t("settingsProjects.createProject.title")}
              titleVariant="h6"
              subtitle={t("settingsProjects.createProject.placeholder")}
              headerActions={<MsqdxIcon name="add" customSize={22} style={{ color: accent }} />}
              sx={{
                minHeight: 140,
                border: "2px dashed",
                borderColor: accent,
                "& .MuiTypography-h6": { color: accent },
              }}
            />
          </Box>
        ) : (
          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            title={t("settingsProjects.createProject.title")}
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
                  onClick={() => {
                    setShowCreate(false);
                    setName("");
                    setError(null);
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
                  onClick={handleCreate}
                  disabled={creating}
                  sx={{
                    backgroundColor: `${accent} !important`,
                    color: "white !important",
                    "&:hover": { backgroundColor: `${accent} !important`, filter: "brightness(1.05)" },
                  }}
                >
                  {creating ? t("settingsProjects.createProject.creating") : t("settingsProjects.createProject.cta")}
                </MsqdxButton>
              </>
            )}
          >
            <Stack spacing={1.5}>
              {showCentralPathHint && (
                <MsqdxTypography variant="caption" sx={{ color: "warning.main" }}>
                  {t("settingsProjects.createProject.centralPathHint")}
                </MsqdxTypography>
              )}
              <MsqdxFormField
                label={t("settingsProjects.createProject.name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("settingsProjects.createProject.placeholder")}
                size="small"
                autoFocus
              />
              {error && (
                <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                  {error}
                </MsqdxTypography>
              )}
            </Stack>
          </MsqdxMoleculeCard>
        )}

        {/* Project cards */}
        {projects.map((project) => (
          <Link key={project.id} href={ADMIN_ROUTES.projectDetail(project.id)} style={{ textDecoration: "none" }}>
            <MsqdxMoleculeCard
              variant="flat"
              borderRadius="button"
              clickable
              hoverable
              title={project.name}
              titleVariant="h6"
              subtitle={project.id}
              chips={projectFederationChipKinds(project).map((kind) => (
                <MsqdxChip
                  key={kind}
                  size="small"
                  variant="outlined"
                  label={
                    kind === "plexon"
                      ? t("settingsProjects.federation.plexon")
                      : kind === "checkion"
                        ? t("settingsProjects.federation.checkion")
                        : t("settingsProjects.federation.localOnly")
                  }
                  sx={{
                    "& .MuiChip-label": {
                      fontSize: "0.7rem",
                      ...(kind === "plexon" ? { color: "success.main" } : {}),
                      ...(kind === "checkion" ? { color: accent } : {}),
                      ...(kind === "local" ? { color: "text.secondary" } : {}),
                    },
                  }}
                />
              ))}
              headerActions={<MsqdxIcon name="chevron_right" customSize={20} style={{ color: accent }} />}
              actions={(
                <MsqdxButton
                  variant="outlined"
                  size="small"
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
          </Link>
        ))}
      </Box>
    </Box>
  );
}

