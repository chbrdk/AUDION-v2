"use client";

import { Box } from "@mui/material";
import { ADMIN_HEADER_V2_CARD_PICKER_DIVIDER_CLASS } from "../../lib/admin-header-layout";
import { useAdminHeaderV2Context } from "../../lib/use-admin-header-v2-context";
import { useProject } from "../projects/project-provider";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassAdminHeaderCompactPicker } from "./msqdx-glass-admin-header-compact-picker";

export function MsqdxGlassAdminHeaderContextPickers() {
  const { t } = useI18n();
  const { projects, activeProjectId, selectProject } = useProject();
  const {
    targetGroupOptions,
    personaOptions,
    activeTargetGroupId,
    activePersonaId,
    loadingTargetGroups,
    loadingPersonas,
    handleTargetGroupChange,
    handlePersonaChange,
  } = useAdminHeaderV2Context();

  const projectOptions = (Array.isArray(projects) ? projects : []).map((project) => ({
    value: project.id,
    label: project.name,
  }));

  return (
    <Box className="msqdx-glass-admin-header-card__pickers">
      <MsqdxGlassAdminHeaderCompactPicker
        label={t("project.label")}
        value={activeProjectId ?? ""}
        options={projectOptions}
        onChange={selectProject}
        emptyLabel={projectOptions.length ? t("project.select") : t("project.none")}
      />
      <span className={ADMIN_HEADER_V2_CARD_PICKER_DIVIDER_CLASS} aria-hidden />
      <MsqdxGlassAdminHeaderCompactPicker
        label={t("personaAdmin.targetGroup")}
        value={activeTargetGroupId}
        options={targetGroupOptions}
        onChange={handleTargetGroupChange}
        emptyLabel={t("targetGroupsAdmin.selectTargetGroup")}
        disabled={!activeProjectId || loadingTargetGroups}
      />
      <span className={ADMIN_HEADER_V2_CARD_PICKER_DIVIDER_CLASS} aria-hidden />
      <MsqdxGlassAdminHeaderCompactPicker
        label={t("nav.personas")}
        value={activePersonaId}
        options={personaOptions}
        onChange={handlePersonaChange}
        emptyLabel={t("personaAdmin.selectPersona")}
        disabled={!activeTargetGroupId || loadingPersonas}
      />
    </Box>
  );
}
