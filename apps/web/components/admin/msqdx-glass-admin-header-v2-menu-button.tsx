"use client";

import { IconButton, Tooltip } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";

export type MsqdxGlassAdminHeaderV2MenuButtonProps = {
  ariaLabel: string;
  tooltip: string;
  onClick: () => void;
};

export function MsqdxGlassAdminHeaderV2MenuButton({
  ariaLabel,
  tooltip,
  onClick,
}: MsqdxGlassAdminHeaderV2MenuButtonProps) {
  return (
    <Tooltip title={tooltip} placement="bottom">
      <IconButton
        type="button"
        className="msqdx-glass-admin-header-v2-menu-button__btn"
        aria-label={ariaLabel}
        onClick={onClick}
        size="small"
      >
        <MsqdxIcon name="menu" customSize={20} />
      </IconButton>
    </Tooltip>
  );
}
