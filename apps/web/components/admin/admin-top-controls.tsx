"use client";

import { Box } from "@mui/material";
import { MsqdxSelect } from "@msqdx/react";

import { useProject } from "../projects/project-provider";
import { BRAND_COLOR } from "../../lib/branding";

export const AdminTopControls = () => {
  const { projects, activeProjectId, selectProject } = useProject();

  const projectOptions = (Array.isArray(projects) ? projects : []).map((project) => ({
    value: project.id,
    label: project.name,
  }));

  return (
    <Box sx={{ minWidth: 180 }}>
      <MsqdxSelect
        label="Project"
        value={activeProjectId ?? ""}
        onChange={(event: any) => selectProject(event.target.value)}
        options={[
          { value: "", label: projectOptions.length ? "Select project" : "No projects" },
          ...projectOptions,
        ]}
        size="small"
        borderColor={BRAND_COLOR}
      />
    </Box>
  );
};
