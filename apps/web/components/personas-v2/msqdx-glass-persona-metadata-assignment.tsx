"use client";

import type { PersonaResponse } from "@msqdx-glass/types";
import { Alert, Box } from "@mui/material";
import { MsqdxSelect } from "@msqdx/react";
import { FORM_FIELD_ACCENT_SX } from "../../lib/theme-accent";
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
        <Box className="msqdx-glass-persona-metadata-assignment__field">
          <MsqdxSelect
            label={t("personaAdmin.project")}
            value={detail.metadata.projectId ?? ""}
            onChange={(e) => void onAssign({ project_id: String(e.target.value ?? ""), target_group_id: "" })}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            fullWidth
            size="medium"
            disabled={disabled}
            sx={FORM_FIELD_ACCENT_SX}
          />
        </Box>
        <Box className="msqdx-glass-persona-metadata-assignment__field">
          <MsqdxSelect
            label={t("personaAdmin.targetGroup")}
            value={targetGroupId ?? ""}
            onChange={(e) =>
              void onAssign({
                target_group_id: e.target.value === "" ? "" : String(e.target.value ?? ""),
              })
            }
            options={[
              { value: "", label: t("personaAdmin.noTargetGroup") },
              ...targetGroups.map((tg) => ({ value: tg.id, label: tg.name })),
            ]}
            displayEmpty
            fullWidth
            size="medium"
            disabled={disabled}
            sx={FORM_FIELD_ACCENT_SX}
          />
        </Box>
      </Box>
    </Box>
  );
}
