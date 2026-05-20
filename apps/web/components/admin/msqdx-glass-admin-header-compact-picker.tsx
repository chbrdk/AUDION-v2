"use client";

import { Box, MenuItem, Select } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";

export type MsqdxGlassAdminHeaderCompactPickerOption = {
  value: string;
  label: string;
};

export type MsqdxGlassAdminHeaderCompactPickerProps = {
  label: string;
  value: string;
  options: MsqdxGlassAdminHeaderCompactPickerOption[];
  onChange: (value: string) => void;
  emptyLabel: string;
  disabled?: boolean;
  className?: string;
};

export function MsqdxGlassAdminHeaderCompactPicker({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  disabled = false,
  className,
}: MsqdxGlassAdminHeaderCompactPickerProps) {
  const activeLabel =
    options.find((option) => option.value === value)?.label ??
    (options.length ? emptyLabel : emptyLabel);

  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value);
  };

  return (
    <Box className={className ?? "msqdx-glass-admin-header-compact-picker"}>
      <span className="msqdx-glass-admin-header-compact-picker__label">{label}</span>
      <Select
        className="msqdx-glass-admin-header-compact-picker__select"
        value={value}
        onChange={handleChange}
        displayEmpty
        size="small"
        variant="outlined"
        disabled={disabled}
        IconComponent={(iconProps) => (
          <MsqdxIcon
            {...iconProps}
            name="arrow_drop_down"
            customSize={22}
            className="msqdx-glass-admin-header-compact-picker__chevron"
          />
        )}
        renderValue={() => (
          <span className="msqdx-glass-admin-header-compact-picker__value">{activeLabel}</span>
        )}
        MenuProps={{
          className: "msqdx-glass-admin-header-compact-picker__menu",
        }}
      >
        <MenuItem value="">{emptyLabel}</MenuItem>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
