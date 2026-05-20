"use client";

import Link from "next/link";
import { IconButton } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";

export type MsqdxGlassAdminHeaderBackIconButtonProps = {
  href: string;
  ariaLabel: string;
};

export function MsqdxGlassAdminHeaderBackIconButton({
  href,
  ariaLabel,
}: MsqdxGlassAdminHeaderBackIconButtonProps) {
  return (
    <Link href={href} className="msqdx-glass-admin-header-v2-back-button" style={{ textDecoration: "none" }}>
      <IconButton
        className="msqdx-glass-admin-header-v2-back-button__btn"
        aria-label={ariaLabel}
        size="small"
      >
        <MsqdxIcon name="arrow_back" customSize={22} />
      </IconButton>
    </Link>
  );
}
