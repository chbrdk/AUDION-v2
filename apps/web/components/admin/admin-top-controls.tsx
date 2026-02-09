"use client";

import { useRouter } from "next/navigation";
import { Box, Stack } from "@mui/material";
import { MsqdxButton, MsqdxSelect, MsqdxTypography } from "@msqdx/react";

import { useAuth } from "../auth/auth-provider";
import { useProject } from "../projects/project-provider";
import { BRAND_COLOR } from "../../lib/branding";

export const AdminTopControls = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { projects, activeProjectId, selectProject } = useProject();

  const projectOptions = (Array.isArray(projects) ? projects : []).map((project) => ({
    value: project.id,
    label: project.name,
  }));

  const handleLogout = async () => {
    await logout();
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    router.replace(`${basePath}/login`);
  };

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
      <MsqdxButton variant="outlined" size="small" onClick={handleLogout}>
        Log out
      </MsqdxButton>
    </Stack>
  );
};
