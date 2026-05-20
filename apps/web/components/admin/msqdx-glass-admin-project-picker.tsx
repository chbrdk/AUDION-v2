"use client";

import { Box, MenuItem, Select } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";
import { useProject } from "../projects/project-provider";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassAdminProjectPickerProps = {
  className?: string;
};

export const MsqdxGlassAdminProjectPicker = ({ className }: MsqdxGlassAdminProjectPickerProps) => {
  const { projects, activeProjectId, selectProject } = useProject();
  const { t } = useI18n();

  const projectOptions = (Array.isArray(projects) ? projects : []).map((project) => ({
    value: project.id,
    label: project.name,
  }));

  const activeLabel =
    projectOptions.find((p) => p.value === activeProjectId)?.label ??
    (projectOptions.length ? t("project.select") : t("project.none"));

  const handleChange = (event: SelectChangeEvent<string>) => {
    selectProject(event.target.value);
  };

  return (
    <Box className={className ?? "msqdx-glass-admin-project-picker"}>
      <span className="msqdx-glass-admin-project-picker__label">{t("project.label")}</span>
      <Select
        className="msqdx-glass-admin-project-picker__select"
        value={activeProjectId ?? ""}
        onChange={handleChange}
        displayEmpty
        size="small"
        variant="outlined"
        IconComponent={(iconProps) => (
          <MsqdxIcon
            {...iconProps}
            name="arrow_drop_down"
            customSize={22}
            className="msqdx-glass-admin-project-picker__chevron"
          />
        )}
        renderValue={() => (
          <span className="msqdx-glass-admin-project-picker__value">{activeLabel}</span>
        )}
        MenuProps={{
          className: "msqdx-glass-admin-project-picker__menu",
        }}
      >
        <MenuItem value="">
          {projectOptions.length ? t("project.select") : t("project.none")}
        </MenuItem>
        {projectOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
};
