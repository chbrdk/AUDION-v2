"use client";

import Link from "next/link";
import { IconButton, Tooltip } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";

export type MsqdxGlassAdminHeaderChatIconButtonProps = {
  href: string;
  ariaLabel: string;
  tooltip: string;
};

export function MsqdxGlassAdminHeaderChatIconButton({
  href,
  ariaLabel,
  tooltip,
}: MsqdxGlassAdminHeaderChatIconButtonProps) {
  return (
    <Tooltip title={tooltip} placement="bottom">
      <Link
        href={href}
        className="msqdx-glass-admin-header-v2-chat-button"
        style={{ textDecoration: "none" }}
      >
        <IconButton
          className="msqdx-glass-admin-header-v2-chat-button__btn"
          aria-label={ariaLabel}
          size="small"
        >
          <MsqdxIcon name="forum" customSize={20} />
        </IconButton>
      </Link>
    </Tooltip>
  );
}
