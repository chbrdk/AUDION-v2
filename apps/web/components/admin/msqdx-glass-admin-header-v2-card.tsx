"use client";

import { useState, type ReactNode } from "react";
import { Box } from "@mui/material";
import {
  ADMIN_HEADER_V2_CARD_CLASS,
  ADMIN_HEADER_V2_CARD_END_CLASS,
  ADMIN_HEADER_V2_CARD_PICKERS_DESKTOP_CLASS,
  ADMIN_HEADER_V2_CARD_START_CLASS,
  ADMIN_HEADER_V2_MENU_BUTTON_WRAP_CLASS,
} from "../../lib/admin-header-layout";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassAdminHeaderContextPickers } from "./msqdx-glass-admin-header-context-pickers";
import { MsqdxGlassAdminHeaderV2ContextDrawer } from "./msqdx-glass-admin-header-v2-context-drawer";
import { MsqdxGlassAdminHeaderV2MenuButton } from "./msqdx-glass-admin-header-v2-menu-button";

export type MsqdxGlassAdminHeaderV2CardProps = {
  end?: ReactNode;
};

export function MsqdxGlassAdminHeaderV2Card({ end }: MsqdxGlassAdminHeaderV2CardProps) {
  const { t } = useI18n();
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  const contextMenuLabel = t("adminHeader.openContextMenu");

  return (
    <>
      <Box className={ADMIN_HEADER_V2_CARD_CLASS} component="div">
        <Box className={ADMIN_HEADER_V2_CARD_START_CLASS}>
          <Box className={ADMIN_HEADER_V2_CARD_PICKERS_DESKTOP_CLASS}>
            <MsqdxGlassAdminHeaderContextPickers />
          </Box>
          <Box className={ADMIN_HEADER_V2_MENU_BUTTON_WRAP_CLASS}>
            <MsqdxGlassAdminHeaderV2MenuButton
              ariaLabel={contextMenuLabel}
              tooltip={contextMenuLabel}
              onClick={() => setContextDrawerOpen(true)}
            />
          </Box>
        </Box>
        {end ? <Box className={ADMIN_HEADER_V2_CARD_END_CLASS}>{end}</Box> : null}
      </Box>
      <MsqdxGlassAdminHeaderV2ContextDrawer
        open={contextDrawerOpen}
        onClose={() => setContextDrawerOpen(false)}
      />
    </>
  );
}
