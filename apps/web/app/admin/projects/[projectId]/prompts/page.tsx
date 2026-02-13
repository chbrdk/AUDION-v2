"use client";

export const dynamic = "force-dynamic";

import { useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Box } from "@mui/material";
import { MsqdxTypography } from "@msqdx/react";
import { useProject } from "../../../../../components/projects/project-provider";
import { useI18n } from "../../../../../components/i18n/i18n-provider";
import { PromptsPageContent } from "../../../settings/prompts/page";

function ProjectPromptsInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = typeof params.projectId === "string" ? params.projectId : null;
  const { selectProject } = useProject();
  const { t } = useI18n();
  const initialEditId = searchParams.get("edit");

  useEffect(() => {
    if (projectId) {
      selectProject(projectId);
    }
  }, [projectId, selectProject]);

  if (!projectId) {
    return (
      <Box sx={{ p: 3 }}>
        <MsqdxTypography variant="body1" sx={{ color: "text.secondary" }}>
          {t("prompts.selectProject")}
        </MsqdxTypography>
      </Box>
    );
  }

  return (
    <PromptsPageContent
      projectId={projectId}
      initialEditId={initialEditId}
    />
  );
}

export default function ProjectPromptsPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 3 }}>
          <MsqdxTypography variant="body2" color="text.secondary">
            Loading…
          </MsqdxTypography>
        </Box>
      }
    >
      <ProjectPromptsInner />
    </Suspense>
  );
}
