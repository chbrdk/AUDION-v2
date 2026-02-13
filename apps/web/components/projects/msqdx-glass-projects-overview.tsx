"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Box, Stack } from "@mui/material";
import { MsqdxButton, MsqdxFormField, MsqdxIcon, MsqdxMoleculeCard, MsqdxTypography } from "@msqdx/react";
import type { ProjectSummary } from "./project-provider";
import { useProject } from "./project-provider";
import { useI18n } from "../i18n/i18n-provider";
import { ADMIN_ROUTES } from "../../lib/routes";

export type MsqdxGlassProjectsOverviewProps = {
  initialProjects: ProjectSummary[];
};

export function MsqdxGlassProjectsOverview({ initialProjects }: MsqdxGlassProjectsOverviewProps) {
  const { t } = useI18n();
  const { projects: providerProjects, createProject, refreshProjects, selectProject } = useProject();
  const accent = "var(--color-theme-accent)";

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(e instanceof Error ? e.message : t("settingsProjects.errors.createProject"));
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
        {/* Create Project */}
        {!showCreate ? (
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

