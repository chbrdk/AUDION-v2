"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, IconButton, Tooltip, useTheme } from "@mui/material";
import { MsqdxButton, MsqdxIcon, MsqdxAdminNav, MsqdxAppLayout, MsqdxTypography } from "@msqdx/react";
import type { AdminNavItem } from "@msqdx/react";
import { useAdminHeader, useAdminPanel } from "./admin-layout-providers";
import { THEME_ACCENT_WITH_FALLBACK } from "../../lib/theme-accent";
import { useThemeMode } from "../theme-registry";
import { AdminTopControls } from "./admin-top-controls";
import { BrandColorInitializer } from "../settings/brand-color-initializer";
import { useI18n } from "../i18n/i18n-provider";
import { BugReportModal } from "../bug-report/BugReportModal";
import { PlexonReturnLink } from "../federation/plexon-return-link";
import { useProject } from "../projects/project-provider";

// Re-export for consumers that import from this file
export { useAdminHeader, useAdminPanel } from "./admin-layout-providers";

const ADMIN_NAV_ITEMS = [
  { labelKey: "nav.dashboard", path: "/admin", icon: "dashboard", exact: true },
  { labelKey: "nav.chat", path: "/admin/chat", icon: "forum" },
  { labelKey: "nav.chatHistory", path: "/admin/chat/history", icon: "history" },
  { labelKey: "nav.projects", path: "/admin/projects", icon: "folder" },
  { labelKey: "nav.personas", path: "/admin/personas", icon: "person" },
  { labelKey: "nav.targetGroups", path: "/admin/target-groups", icon: "groups" },
  { labelKey: "nav.journeys", path: "/admin/journeys", icon: "route" },
  { labelKey: "nav.uxJourneyAgent", path: "/admin/ux-journey-agent", icon: "travel_explore" },
] as const;

const ADMIN_NAV_EXTERNAL_ITEMS = [
  { labelKey: "nav.profile", path: "/admin/profile", icon: "account_circle" },
  { labelKey: "nav.settings", path: "/admin/settings", icon: "settings" },
] as const;

export type MsqdxGlassAdminLayoutClientProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

export const MsqdxGlassAdminLayoutClient = ({ children, title, subtitle }: MsqdxGlassAdminLayoutClientProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false); // Default open on desktop
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const pathname = usePathname();
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const { t } = useI18n();
  const isMonochromeDark = themeMode === "monochrome-dark";
  const isMonochromeLight = themeMode === "monochrome-light";
  const isMonochrome = isMonochromeDark || isMonochromeLight;
  const isDarkApp = themeMode === "dark" || isMonochromeDark;
  const chromeBackground = isMonochromeDark
    ? "#ffffff"
    : isMonochromeLight
      ? "#000000"
      : THEME_ACCENT_WITH_FALLBACK.backgroundColor;
  const chromeIconColor = isMonochromeDark
    ? "#000000"
    : isMonochromeLight
      ? "#ffffff"
      : theme.palette.mode === "dark"
        ? "#fff"
        : "#000";
  const appInnerBackgroundColor = isMonochromeDark
    ? "#000000"
    : isMonochromeLight
      ? "#ffffff"
      : isDarkApp
        ? "#000000"
        : undefined;
  const appInnerBackground = isMonochrome || isDarkApp ? "default" : "offwhite";
  const { activeProjectId } = useProject();
  // Get headerContent from context - safe for SSR with default value
  const { headerContent } = useAdminHeader();
  // Get panel state from context
  const { panelOpen, togglePanel, setPanelOpen } = useAdminPanel();

  const personaIdFromPath = useMemo(() => {
    if (!pathname) return null;
    const m = pathname.match(/^\/admin\/personas\/([^/]+)$/);
    return m?.[1] ?? null;
  }, [pathname]);

  const directChatHref = useMemo(() => {
    if (!personaIdFromPath) return null;
    const params = new URLSearchParams();
    params.set("personaId", personaIdFromPath);
    if (activeProjectId) params.set("projectId", activeProjectId);
    return `/admin/chat?${params.toString()}`;
  }, [personaIdFromPath, activeProjectId]);

  const handleDrawerToggle = () => {
    setDrawerOpen((prev) => !prev);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const handleOpenBugModal = () => setBugModalOpen(true);
  const handleCloseBugModal = () => setBugModalOpen(false);

  const handleSubmitBug = (description: string) => {
    // TODO: Send bug report to API
    console.log("Bug Report Submitted:", description);
    handleCloseBugModal();
  };

  const handlePanelClose = () => {
    setPanelOpen(false);
  };

  const navItems = ADMIN_NAV_ITEMS.map((item) => ({
    ...item,
    label: t(item.labelKey),
  })) as AdminNavItem[];

  const navExternalItems = [
    ...ADMIN_NAV_EXTERNAL_ITEMS.map((item) => ({
      ...item,
      label: t(item.labelKey),
    })),
    { 
      label: "Bug Report", 
      icon: "bug_report", 
      onClick: handleOpenBugModal 
    },
  ] as AdminNavItem[];

  // Get page title from pathname
  const getPageTitle = () => {
    if (!pathname) return "";
    
    const pathMap: Record<string, string> = {
      "/admin": t("nav.dashboard"),
      "/admin/chat": t("nav.chat"),
      "/admin/chat/history": t("nav.chatHistory"),
      "/admin/projects": t("nav.projects"),
      "/admin/personas": t("nav.personas"),
      "/admin/target-groups": t("nav.targetGroups"),
      "/admin/journeys": t("nav.journeys"),
      "/admin/ux-journey-agent": t("nav.uxJourneyAgent"),
      "/admin/profile": t("nav.profile"),
      "/admin/settings": t("nav.settings"),
    };

    // Check exact match first
    if (pathMap[pathname]) {
      return pathMap[pathname];
    }

    // Check if pathname starts with any key
    for (const [path, label] of Object.entries(pathMap)) {
      if (pathname.startsWith(path) && path !== "/admin") {
        return label;
      }
    }

    return "";
  };

  // Get page icon from pathname (matching navigation items)
  const getPageIcon = () => {
    if (!pathname) return "toc";
    
    const iconMap: Record<string, string> = {
      "/admin": "dashboard",
      "/admin/chat": "forum",
      "/admin/chat/history": "history",
      "/admin/projects": "folder",
      "/admin/personas": "person",
      "/admin/target-groups": "groups",
      "/admin/journeys": "route",
      "/admin/ux-journey-agent": "travel_explore",
      "/admin/profile": "account_circle",
      "/admin/settings": "settings",
    };

    // Check exact match first (e.g., /admin/chat/history)
    if (iconMap[pathname]) {
      return iconMap[pathname];
    }

    // Check if pathname starts with any key (in order of specificity)
    const sortedPaths = Object.keys(iconMap).sort((a, b) => b.length - a.length);
    for (const path of sortedPaths) {
      if (pathname.startsWith(path) && path !== "/admin") {
        return iconMap[path];
      }
    }

    // Default fallback
    return "toc";
  };

  return (
    <>
      <BrandColorInitializer />
      <Box className="msqdx-glass-app-layout" sx={{ display: "contents" }}>
      <MsqdxAppLayout
        sidebar={
          <MsqdxAdminNav
            open={drawerOpen}
            onClose={handleDrawerClose}
            currentPath={pathname || ""}
            items={navItems}
            externalItems={navExternalItems}
            linkComponent={Link as any}
            sx={{
              backgroundColor: chromeBackground,
              borderRight: "none",
            }}
          />
        }
        logo={isMonochrome ? { size: "small", color: chromeIconColor } : true}
        appName="Audion"
        brandBackgroundColor={chromeBackground}
        innerBackground={appInnerBackground}
        innerBackgroundColor={appInnerBackgroundColor}
        borderWidth="none"
        sx={{
          "& > div:last-of-type": {
            backgroundColor: `${chromeBackground} !important`,
            top: "auto",
            left: "auto",
          },
          "& > div:last-of-type > div": {
            border: "none !important",
            top: "auto",
            left: "auto",
            ...(appInnerBackgroundColor
              ? { backgroundColor: `${appInnerBackgroundColor} !important` }
              : {}),
          },
          /* Content column (profile, settings, etc.) – no absolute offsets */
          "& > div:last-of-type > div > div:last-of-type": {
            position: "relative",
            top: "auto",
            left: "auto",
            flex: 1,
            minHeight: 0,
          },
          /* Corner/Logo – absolut positioniert; Logo-SVG nutzt festes fill, daher color hier + logo-Prop. */
          "& > div:last-of-type > div > div:first-of-type": {
            position: "absolute !important",
            top: 0,
            left: 0,
            zIndex: 100000,
            backgroundColor: "transparent !important",
            color: isMonochrome ? `${chromeIconColor} !important` : "var(--color-theme-accent-contrast, #ffffff) !important",
          },
          "& > div:last-of-type > div > div:first-of-type *": {
            color: "inherit !important",
          },
          ...(isMonochrome
            ? {
                "& > div:last-of-type > div > div:first-of-type svg path": {
                  fill: `${chromeIconColor} !important`,
                },
              }
            : {
                "& > div:last-of-type > div > div:first-of-type svg": {
                  fill: "currentColor",
                },
              }),
          "& > div:last-of-type > div > div:first-of-type > div": {
            backgroundColor: `${chromeBackground} !important`,
          },
        }}
      >
      {/* Wrapper so main (absolute) positions relative to this container; header and main both start at top, main under header (z-index) */}
      <Box sx={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* Header Bar – Page Title, Hamburger, Panel Toggle (Logo/Corner via MsqdxAppLayout) */}
      <Box
        className="msqdx-glass-admin-header-bar-mask msqdx-glass-admin-header-bar--fade-bottom"
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          overflow: "visible",
        }}
      >
        <Box
          component="header"
          className="msqdx-glass-admin-header-bar"
          suppressHydrationWarning
          sx={{
            position: "relative",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: { xs: "0.75rem 1rem", md: "1rem 1.5rem" },
            minHeight: { xs: "56px", md: "64px" },
            backgroundColor: "var(--msqdx-glass-admin-header-bar-bg)",
            backdropFilter: "saturate(180%) blur(16px)",
            WebkitBackdropFilter: "saturate(180%) blur(16px)",
            borderBottom: "none",
            overflow: "visible",
          }}
        >
        <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              marginLeft: { md: "230px" },
            }}
          >
            <AdminTopControls />
          </Box>
        </Box>
        {/* Page Title or Custom Header Content */}
        <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1 }}>
          <PlexonReturnLink compact />
          {headerContent ? (
            <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>
              {headerContent}
            </Box>
          ) : getPageTitle() ? (
            <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1 }}>
              {directChatHref ? (
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
                      // Align perfectly with the headline baseline/line-height.
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                      // Use the same brand accent token as the rest of the admin chrome.
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
              ) : null}
              <MsqdxTypography
                variant="h4"
                sx={{
                  fontSize: { xs: "1.5rem", md: "36px" },
                  textTransform: "lowercase",
                  fontWeight: 800,
                  letterSpacing: "-2px",
                  color: "text.primary",
                  display: { xs: "none", md: "block" },
                }}
              >
                {getPageTitle()}
              </MsqdxTypography>
            </Box>
          ) : null}
        </Box>
        {/* Hamburger button - mobile only */}
        <Box
          sx={{
            position: { xs: "absolute", md: "static" },
            left: { xs: "1rem", md: "auto" },
            top: { xs: "7px", md: "auto" },
            zIndex: 1201
          }}
        >
          <IconButton
            onClick={handleDrawerToggle}
            sx={{
              color: (t) => (t.palette.mode === "dark" ? "#000" : "var(--color-text-primary)"),
              padding: { xs: "16px", md: "8px" },
              display: { xs: drawerOpen ? "none" : "flex", md: "none" },
              width: { xs: 64, md: "auto" },
              height: { xs: 64, md: "auto" }
            }}
            aria-label={t("common.toggleNavigation")}
          >
            <MsqdxIcon name="menu" customSize={32} />
          </IconButton>
        </Box>

        {/* Panel toggle - mobile only */}
        <Box
          onClick={togglePanel}
          sx={{
            display: { xs: drawerOpen ? "none" : "flex", md: "none" },
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "0 30px 30px 0",
            cursor: "pointer",
            minWidth: 90,
            minHeight: 40,
            position: "absolute",
            left: { xs: 80, md: -9999 },
            top: { xs: "20px", md: "66px" },
            zIndex: 1202,
            "&:hover": { opacity: 0.9 }
          }}
          aria-label={t("common.togglePanel")}
        >
          <Box sx={{ color: chromeIconColor }}>
            <MsqdxIcon name={getPageIcon()} customSize={32} />
          </Box>
        </Box>
        </Box>
      </Box>

      {/* Content Area – starts at top, under header (lower z-index); padding-top clears header height */}
      <Box
        component="main"
        className="msqdx-glass-admin-content"
        suppressHydrationWarning
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          overflowX: "hidden",
          overflowY: "auto",
          padding: { xs: "1rem", md: "1.5rem" },
          paddingTop: "100px !important",
          minWidth: 0,
          maxWidth: "100%",
          width: "100%"
        }}
      >
        {title && (
          <Box sx={{ marginBottom: "1.5rem" }}>
            <MsqdxTypography variant="h3" sx={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              {title}
            </MsqdxTypography>
            {subtitle && (
              <MsqdxTypography variant="body1" sx={{ color: "text.secondary" }}>
                {subtitle}
              </MsqdxTypography>
            )}
          </Box>
        )}
        {children}
      </Box>
      </Box>

      {/* Mobile Overlay for Navigation */}
      {drawerOpen && (
        <Box
          onClick={handleDrawerClose}
          sx={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1099,
            display: { xs: "block", md: "none" }
          }}
        />
      )}

      {/* Mobile Overlay for Panel */}
      {panelOpen && (
        <Box
          onClick={handlePanelClose}
          sx={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1198,
            display: { xs: "block", md: "none" }
          }}
        />
      )}
    </MsqdxAppLayout>
      </Box>
      <BugReportModal
        open={bugModalOpen}
        onClose={handleCloseBugModal}
        onSubmit={handleSubmitBug}
      />
    </>
  );
};
