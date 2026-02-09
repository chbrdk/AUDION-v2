"use client";

import { Box, Stack } from "@mui/material";
import { MsqdxSelect, MsqdxTypography } from "@msqdx/react";

import { useAuth } from "../auth/auth-provider";
import { useProject } from "../projects/project-provider";
import { BRAND_COLOR } from "../../lib/branding";

export const AdminTopControls = () => {
  const { user } = useAuth();
  const { projects, activeProjectId, selectProject } = useProject();

  const projectOptions = (Array.isArray(projects) ? projects : []).map((project) => ({
    value: project.id,
    label: project.name,
  }));

  return (
    <Stack direction="row" spacing={2} alignItems="center">
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
      {user && (
        <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
          {user.email}
        </MsqdxTypography>
      )}
    </Stack>
  );
};
