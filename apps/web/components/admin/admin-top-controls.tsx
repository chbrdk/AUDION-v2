"use client";

import { Box } from "@mui/material";
import { MsqdxSelect } from "@msqdx/react";

import { useProject } from "../projects/project-provider";
import { BRAND_COLOR } from "../../lib/branding";
import { useI18n } from "../i18n/i18n-provider";

export const AdminTopControls = () => {
  const { projects, activeProjectId, selectProject } = useProject();
  const { t } = useI18n();

  const projectOptions = (Array.isArray(projects) ? projects : []).map((project) => ({
    value: project.id,
    label: project.name,
  }));

  return (
    <Box sx={{ minWidth: 180 }}>
      <MsqdxSelect
        label={t("project.label")}
        value={activeProjectId ?? ""}
        onChange={(event: any) => selectProject(event.target.value)}
        options={[
          { value: "", label: projectOptions.length ? t("project.select") : t("project.none") },
          ...projectOptions,
        ]}
        size="small"
        borderColor={BRAND_COLOR}
      />
    </Box>
  );
};
