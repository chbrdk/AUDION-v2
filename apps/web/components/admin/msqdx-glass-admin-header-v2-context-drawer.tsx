"use client";

import { Box, Drawer, IconButton, Typography } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";
import { ADMIN_HEADER_V2_CONTEXT_DRAWER_CLASS } from "../../lib/admin-header-layout";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassAdminHeaderContextPickers } from "./msqdx-glass-admin-header-context-pickers";

export type MsqdxGlassAdminHeaderV2ContextDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function MsqdxGlassAdminHeaderV2ContextDrawer({
  open,
  onClose,
}: MsqdxGlassAdminHeaderV2ContextDrawerProps) {
  const { t } = useI18n();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      className={`${ADMIN_HEADER_V2_CONTEXT_DRAWER_CLASS}-root`}
      PaperProps={{ className: ADMIN_HEADER_V2_CONTEXT_DRAWER_CLASS }}
      ModalProps={{ keepMounted: true }}
    >
      <Box className={`${ADMIN_HEADER_V2_CONTEXT_DRAWER_CLASS}__header`}>
        <Typography
          component="h2"
          variant="subtitle2"
          className={`${ADMIN_HEADER_V2_CONTEXT_DRAWER_CLASS}__title`}
        >
          {t("adminHeader.contextDrawerTitle")}
        </Typography>
        <IconButton
          type="button"
          size="small"
          aria-label={t("common.close")}
          onClick={onClose}
          className={`${ADMIN_HEADER_V2_CONTEXT_DRAWER_CLASS}__close`}
        >
          <MsqdxIcon name="close" customSize={22} />
        </IconButton>
      </Box>
      <MsqdxGlassAdminHeaderContextPickers layout="stack" />
    </Drawer>
  );
}
