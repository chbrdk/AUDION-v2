"use client";

import type { PersonaResponse } from "@msqdx-glass/types";
import { Alert, Box } from "@mui/material";
import { MsqdxTypography } from "@msqdx/react";
import { useI18n } from "../i18n/i18n-provider";

export type PersonaMetadataAssignmentProject = {
  id: string;
  name: string;
};

export type PersonaMetadataAssignmentTargetGroup = {
  id: string;
  name: string;
};

export type MsqdxGlassPersonaMetadataAssignmentProps = {
  detail: PersonaResponse;
  projects: readonly PersonaMetadataAssignmentProject[];
  targetGroups: readonly PersonaMetadataAssignmentTargetGroup[];
  disabled?: boolean;
  onAssign: (payload: { project_id?: string; target_group_id?: string }) => void | Promise<void>;
};

/** Project + target group assignment (no read-only audit stats). */
export function MsqdxGlassPersonaMetadataAssignment({
  detail,
  projects,
  targetGroups,
  disabled = false,
  onAssign,
}: MsqdxGlassPersonaMetadataAssignmentProps) {
  const { t } = useI18n();
  const targetGroupId =
    detail.metadata.targetGroupId ?? (detail.profile as { targetGroupId?: string }).targetGroupId;

  return (
    <Box className="msqdx-glass-persona-metadata-assignment">
      {!targetGroupId ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("personaAdmin.noTargetGroupDetailHint")}
        </Alert>
      ) : null}
      <Box className="msqdx-glass-persona-metadata-assignment__fields">
        <Box sx={{ minWidth: 200, flex: "1 1 200px" }}>
          <MsqdxTypography
            variant="caption"
            sx={{
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "block",
              mb: 0.5,
            }}
          >
            {t("personaAdmin.project")}
          </MsqdxTypography>
          <Box
            component="select"
            value={detail.metadata.projectId ?? ""}
            onChange={(e) => void onAssign({ project_id: e.target.value, target_group_id: "" })}
            disabled={disabled}
            className="msqdx-glass-persona-metadata-assignment__select"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Box>
        </Box>
        <Box sx={{ minWidth: 200, flex: "1 1 200px" }}>
          <MsqdxTypography
            variant="caption"
            sx={{
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "block",
              mb: 0.5,
            }}
          >
            {t("personaAdmin.targetGroup")}
          </MsqdxTypography>
          <Box
            component="select"
            value={targetGroupId ?? ""}
            onChange={(e) =>
              void onAssign({ target_group_id: e.target.value === "" ? "" : e.target.value })
            }
            disabled={disabled}
            className="msqdx-glass-persona-metadata-assignment__select"
          >
            <option value="">{t("personaAdmin.noTargetGroup")}</option>
            {targetGroups.map((tg) => (
              <option key={tg.id} value={tg.id}>
                {tg.name}
              </option>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
