"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Box, Stack } from "@mui/material";
import { MsqdxButton, MsqdxCard, MsqdxFormField, MsqdxIcon, MsqdxTypography } from "@msqdx/react";
import type { ProjectSummary } from "./project-provider";
import { useProject } from "./project-provider";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassProjectsOverviewProps = {
  initialProjects: ProjectSummary[];
};

export function MsqdxGlassProjectsOverview({ initialProjects }: MsqdxGlassProjectsOverviewProps) {
  const { t } = useI18n();
  const { projects: providerProjects, createProject, refreshProjects, selectProject } = useProject();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projects = useMemo(() => (providerProjects.length ? providerProjects : initialProjects), [providerProjects, initialProjects]);

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
      setError(e instanceof Error ? e.message : "Failed to create project");
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
        {/* Create card */}
        {!showCreate ? (
          <MsqdxCard
            variant="flat"
            clickable
            hoverable
            onClick={() => setShowCreate(true)}
            sx={{
              minHeight: 140,
              border: "2px dashed",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Stack spacing={1} alignItems="center">
              <MsqdxIcon name="add" customSize={28} sx={{ color: "text.secondary" }} />
              <MsqdxTypography variant="subtitle2" weight="semibold" sx={{ color: "text.secondary" }}>
                {t("settingsProjects.createProject.title")}
              </MsqdxTypography>
            </Stack>
          </MsqdxCard>
        ) : (
          <MsqdxCard variant="flat" sx={{ minHeight: 140 }}>
            <Stack spacing={1.5}>
              <MsqdxTypography variant="subtitle2" weight="semibold">
                {t("settingsProjects.createProject.title")}
              </MsqdxTypography>
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
              <Stack direction="row" spacing={1}>
                <MsqdxButton variant="contained" size="small" onClick={handleCreate} disabled={creating} fullWidth>
                  {creating ? t("settingsProjects.createProject.creating") : t("settingsProjects.createProject.cta")}
                </MsqdxButton>
                <MsqdxButton
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setShowCreate(false);
                    setName("");
                    setError(null);
                  }}
                  disabled={creating}
                >
                  {t("common.cancel")}
                </MsqdxButton>
              </Stack>
            </Stack>
          </MsqdxCard>
        )}

        {/* Project cards */}
        {projects.map((project) => (
          <Link key={project.id} href={`/admin/projects/${project.id}`} style={{ textDecoration: "none" }}>
            <MsqdxCard variant="flat" clickable hoverable sx={{ minHeight: 140 }}>
              <Stack spacing={0.75}>
                <MsqdxTypography variant="h6" weight="semibold">
                  {project.name}
                </MsqdxTypography>
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                  {project.id}
                </MsqdxTypography>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1 }}>
                  <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                    {t("common.view")}
                  </MsqdxTypography>
                  <MsqdxIcon name="chevron_right" customSize={18} sx={{ color: "text.secondary" }} />
                </Box>
              </Stack>
            </MsqdxCard>
          </Link>
        ))}
      </Box>
    </Box>
  );
}

