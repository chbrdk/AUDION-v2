"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { MsqdxIcon, MsqdxAppLayout } from "@msqdx/react";
import { useAuth } from "../auth/auth-provider";
import { THEME_ACCENT_WITH_FALLBACK } from "../../lib/theme-accent";
import { BrandColorInitializer } from "../settings/brand-color-initializer";

export function ChatShareLayout({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { user, loading } = useAuth();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--color-neutral)",
        }}
      >
        <Typography color="text.secondary">Loading…</Typography>
      </Box>
    );
  }

  return (
    <>
      <BrandColorInitializer />
      <MsqdxAppLayout
        logo
        appName="Audion"
        innerBackground="grid"
        borderWidth="thick"
        sidebar={null}
        sx={{
          "& > div:last-of-type": {
            backgroundColor: `${THEME_ACCENT_WITH_FALLBACK.backgroundColor} !important`,
          },
          "& > div:last-of-type > div": {
            borderColor: `${THEME_ACCENT_WITH_FALLBACK.borderColor} !important`,
          },
          "& > div:last-of-type > div > div:first-of-type": {
            backgroundColor: "transparent !important",
            color: "var(--color-theme-accent-contrast, #ffffff) !important",
          },
          "& > div:last-of-type > div > div:first-of-type *": {
            color: "inherit !important",
          },
          "& > div:last-of-type > div > div:first-of-type svg": {
            fill: "currentColor",
          },
          "& > div:last-of-type > div > div:first-of-type > div": {
            backgroundColor: `${THEME_ACCENT_WITH_FALLBACK.backgroundColor} !important`,
          },
        }}
      >
        {/* Header Bar – nur „Back to Admin“ / „Sign in“, kein Hamburger, keine Nav */}
        <Box
          component="header"
          className="msqdx-glass-admin-header-bar"
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: { xs: "0.75rem 1rem", md: "1rem 1.5rem" },
            minHeight: { xs: "56px", md: "64px" },
            backgroundColor: "transparent",
            overflow: "visible",
          }}
        >
          <Button
            component={Link}
            href={user ? `${basePath}/admin` : `${basePath}/login`}
            startIcon={<MsqdxIcon name={user ? "arrow_back" : "login"} customSize={20} />}
            sx={{
              textTransform: "none",
              color: theme.palette.text.primary,
              "&:hover": { backgroundColor: theme.palette.action.hover },
            }}
          >
            {user ? "Back to Admin" : "Sign in"}
          </Button>
        </Box>

        {/* Content Area – gleiche Klasse wie Admin für einheitliches Styling */}
        <Box
          component="main"
          className="msqdx-glass-admin-content"
          sx={{
            flex: 1,
            overflowX: "hidden",
            overflowY: "auto",
            padding: { xs: "1rem", md: "1.5rem" },
            minWidth: 0,
            maxWidth: "100%",
            width: "100%",
          }}
        >
          {children}
        </Box>
      </MsqdxAppLayout>
    </>
  );
}
