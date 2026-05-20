"use client";

import Link from "next/link";
import { Box, Tooltip } from "@mui/material";
import { MsqdxButton, MsqdxIcon, MsqdxTypography } from "@msqdx/react";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassAdminHeaderPageTitleProps = {
  pageIcon: string;
  pageTitle: string;
  directChatHref?: string | null;
  isMonochromeDark?: boolean;
  isMonochromeLight?: boolean;
  /** Legacy frosted bar typography; v2 card uses CSS class on the label. */
  variant?: "bar" | "card";
};

export function MsqdxGlassAdminHeaderPageTitle({
  pageIcon,
  pageTitle,
  directChatHref,
  isMonochromeDark = false,
  isMonochromeLight = false,
  variant = "bar",
}: MsqdxGlassAdminHeaderPageTitleProps) {
  const { t } = useI18n();

  if (!pageTitle) return null;

  const chatButton = directChatHref ? (
    <Tooltip title={t("nav.chat")} placement="bottom">
      <MsqdxButton
        component={Link as any}
        href={directChatHref}
        variant="outlined"
        size="small"
        aria-label={t("nav.chat")}
        sx={{
          minWidth: 32,
          minHeight: 32,
          width: 32,
          height: 32,
          p: 0,
          borderRadius: "rounded",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          color: isMonochromeDark
            ? "#000000"
            : isMonochromeLight
              ? "#ffffff"
              : "var(--color-theme-accent)",
          borderColor: isMonochromeDark
            ? "rgba(0, 0, 0, 0.35)"
            : isMonochromeLight
              ? "rgba(255, 255, 255, 0.35)"
              : "var(--color-theme-accent)",
          "&:hover": {
            borderColor: isMonochromeDark
              ? "#000000"
              : isMonochromeLight
                ? "#ffffff"
                : "var(--color-theme-accent)",
            backgroundColor: "transparent",
          },
        }}
      >
        <MsqdxIcon name="forum" customSize={18} />
      </MsqdxButton>
    </Tooltip>
  ) : null;

  if (variant === "card") {
    return (
      <Box className="msqdx-glass-admin-header-page-title">
        {chatButton}
        <MsqdxIcon name={pageIcon} customSize={28} />
        <span className="msqdx-glass-admin-header-page-title__label">{pageTitle}</span>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {chatButton}
      <MsqdxTypography
        variant="h4"
        sx={{
          fontSize: { xs: "1.5rem", md: "36px" },
          textTransform: "lowercase",
          fontWeight: 800,
          letterSpacing: "-2px",
          color: "text.primary",
        }}
      >
        {pageTitle}
      </MsqdxTypography>
    </Box>
  );
}
