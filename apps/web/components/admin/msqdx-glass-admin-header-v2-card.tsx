"use client";

import type { ReactNode } from "react";
import { Box } from "@mui/material";
import {
  ADMIN_HEADER_V2_CARD_CLASS,
  ADMIN_HEADER_V2_CARD_DIVIDER_CLASS,
  ADMIN_HEADER_V2_CARD_END_CLASS,
  ADMIN_HEADER_V2_CARD_START_CLASS,
} from "../../lib/admin-header-layout";
import { MsqdxGlassAdminProjectPicker } from "./msqdx-glass-admin-project-picker";

export type MsqdxGlassAdminHeaderV2CardProps = {
  startAfterProject?: ReactNode;
  end?: ReactNode;
};

export function MsqdxGlassAdminHeaderV2Card({ startAfterProject, end }: MsqdxGlassAdminHeaderV2CardProps) {
  const showStartDivider = Boolean(startAfterProject);

  return (
    <Box className={ADMIN_HEADER_V2_CARD_CLASS} component="div">
      <Box className={ADMIN_HEADER_V2_CARD_START_CLASS}>
        <MsqdxGlassAdminProjectPicker />
        {showStartDivider ? <span className={ADMIN_HEADER_V2_CARD_DIVIDER_CLASS} aria-hidden /> : null}
        {startAfterProject}
      </Box>
      {end ? <Box className={ADMIN_HEADER_V2_CARD_END_CLASS}>{end}</Box> : null}
    </Box>
  );
}
