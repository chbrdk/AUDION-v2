"use client";

import type { ReactNode } from "react";
import { Box } from "@mui/material";
import {
  ADMIN_HEADER_V2_CARD_CLASS,
  ADMIN_HEADER_V2_CARD_END_CLASS,
  ADMIN_HEADER_V2_CARD_PICKERS_DESKTOP_CLASS,
  ADMIN_HEADER_V2_CARD_START_CLASS,
} from "../../lib/admin-header-layout";
import { AdminHeaderV2ContextMenuProvider } from "../../lib/admin-header-v2-context-menu";
import { MsqdxGlassAdminHeaderContextPickers } from "./msqdx-glass-admin-header-context-pickers";

export type MsqdxGlassAdminHeaderV2CardProps = {
  end?: ReactNode;
};

export function MsqdxGlassAdminHeaderV2Card({ end }: MsqdxGlassAdminHeaderV2CardProps) {
  return (
    <AdminHeaderV2ContextMenuProvider>
      <Box className={ADMIN_HEADER_V2_CARD_CLASS} component="div">
        <Box className={ADMIN_HEADER_V2_CARD_START_CLASS}>
          <Box className={ADMIN_HEADER_V2_CARD_PICKERS_DESKTOP_CLASS}>
            <MsqdxGlassAdminHeaderContextPickers />
          </Box>
        </Box>
        {end ? <Box className={ADMIN_HEADER_V2_CARD_END_CLASS}>{end}</Box> : null}
      </Box>
    </AdminHeaderV2ContextMenuProvider>
  );
}
