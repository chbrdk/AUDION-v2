"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, IconButton, useTheme } from "@mui/material";
import { MsqdxIcon, MsqdxAdminNav, MsqdxAppLayout, MsqdxTypography } from "@msqdx/react";
import type { AdminNavItem } from "@msqdx/react";
import { useAdminHeader, useAdminPanel } from "./admin-layout-providers";
import { THEME_ACCENT_WITH_FALLBACK } from "../../lib/theme-accent";
import { useThemeMode } from "../theme-registry";
import { AdminTopControls } from "./admin-top-controls";
import { MsqdxGlassAdminHeaderV2Card } from "./msqdx-glass-admin-header-v2-card";
import { MsqdxGlassAdminHeaderPageTitle } from "./msqdx-glass-admin-header-page-title";
import { ADMIN_HEADER_V2_BAR_CLASS, isPersonasV2AdminPath } from "../../lib/admin-header-layout";
import { BrandColorInitializer } from "../settings/brand-color-initializer";
import { useI18n } from "../i18n/i18n-provider";
import { BugReportModal } from "../bug-report/BugReportModal";
import { PlexonReturnLink } from "../federation/plexon-return-link";
import { useProject } from "../projects/project-provider";

// Re-export for consumers that import from this file
export { useAdminHeader, useAdminPanel } from "./admin-layout-providers";

/** Matches MsqdxAdminNav drawer mode (`theme.breakpoints.down("md")`). */
const NAV_DOCKED_BREAKPOINT = "md";

const ADMIN_NAV_ITEMS = [
  { labelKey: "nav.dashboard", path: "/admin", icon: "dashboard", exact: true },
  { labelKey: "nav.chat", path: "/admin/chat", icon: "forum" },
  { labelKey: "nav.chatHistory", path: "/admin/chat/history", icon: "history" },
  { labelKey: "nav.projects", path: "/admin/projects", icon: "folder" },
  { labelKey: "nav.personas", path: "/admin/personas", icon: "person" },
  { labelKey: "nav.personasV2", path: "/admin/personas-v2", icon: "view_sidebar" },
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
  /** Border on light chrome (sidebar). */
  const chromeBorderOnLight = isMonochromeDark
    ? "rgba(0, 0, 0, 0.12)"
    : isMonochromeLight
      ? "#ffffff"
      : THEME_ACCENT_WITH_FALLBACK.borderColor;
  /** Border on app content frame. */
  const chromeBorderOnDark = isMonochromeDark
    ? "#ffffff"
    : isMonochromeLight
      ? "#000000"
      : THEME_ACCENT_WITH_FALLBACK.borderColor;
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
  const isPersonasV2Chrome = isPersonasV2AdminPath(pathname);
  // Get headerContent from context - safe for SSR with default value
  const { headerContent, headerStartContent } = useAdminHeader();
  // Get panel state from context
  const { panelOpen, togglePanel, setPanelOpen } = useAdminPanel();

  const personaIdFromPath = useMemo(() => {
    if (!pathname) return null;
    const m =
      pathname.match(/^\/admin\/personas\/([^/]+)$/) ??
      pathname.match(/^\/admin\/personas-v2\/([^/]+)(?:\/|$)/);
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
      "/admin/personas-v2": t("nav.personasV2"),
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
      "/admin/personas-v2": "view_sidebar",
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

  const pageTitle = getPageTitle();
  const pageIcon = getPageIcon();
  const defaultHeaderEnd =
    headerContent ??
    (pageTitle ? (
      <MsqdxGlassAdminHeaderPageTitle
        pageIcon={pageIcon}
        pageTitle={pageTitle}
        directChatHref={directChatHref}
        isMonochromeDark={isMonochromeDark}
        isMonochromeLight={isMonochromeLight}
        variant={isPersonasV2Chrome ? "card" : "bar"}
      />
    ) : null);

  const headerEndCluster = (
    <>
      <PlexonReturnLink compact />
      {defaultHeaderEnd}
    </>
  );

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
              borderRightColor: chromeBorderOnLight,
              borderRightWidth: 1,
              borderRightStyle: "solid",
            }}
          />
        }
        logo={isMonochrome ? { size: "small", color: chromeIconColor } : true}
        appName="Audion"
        brandBackgroundColor={chromeBackground}
        innerBackground={appInnerBackground}
        innerBackgroundColor={appInnerBackgroundColor}
        borderWidth="thick"
        sx={{
          "& > div:last-of-type": {
            backgroundColor: `${chromeBackground} !important`,
            top: "auto",
            left: "auto",
          },
          "& > div:last-of-type > div": {
            borderColor: `${chromeBorderOnDark} !important`,
            borderTopColor: `${chromeBorderOnDark} !important`,
            borderRightColor: `${chromeBorderOnDark} !important`,
            borderBottomColor: `${chromeBorderOnDark} !important`,
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
        className={
          isPersonasV2Chrome
            ? `msqdx-glass-admin-header-bar-mask ${ADMIN_HEADER_V2_BAR_CLASS}`
            : "msqdx-glass-admin-header-bar-mask msqdx-glass-admin-header-bar--fade-bottom"
        }
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
          className={
            isPersonasV2Chrome
              ? `msqdx-glass-admin-header-bar ${ADMIN_HEADER_V2_BAR_CLASS}`
              : "msqdx-glass-admin-header-bar"
          }
          suppressHydrationWarning
          sx={{
            position: "relative",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isPersonasV2Chrome
              ? 0
              : { xs: "0.75rem 1rem", md: "1rem 1.5rem" },
            minHeight: isPersonasV2Chrome ? "auto" : { xs: "56px", md: "64px" },
            backgroundColor: isPersonasV2Chrome
              ? "transparent"
              : "var(--msqdx-glass-admin-header-bar-bg)",
            backdropFilter: isPersonasV2Chrome ? "none" : "saturate(180%) blur(16px)",
            WebkitBackdropFilter: isPersonasV2Chrome ? "none" : "saturate(180%) blur(16px)",
            borderBottom: "none",
            overflow: "visible",
          }}
        >
        {isPersonasV2Chrome ? (
          <Box
            sx={{
              display: { xs: "none", [NAV_DOCKED_BREAKPOINT]: "flex" },
              flex: 1,
              minWidth: 0,
              width: "100%",
            }}
          >
            <MsqdxGlassAdminHeaderV2Card
              startAfterProject={headerStartContent}
              end={headerEndCluster}
            />
          </Box>
        ) : (
          <>
            <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
              <Box
                sx={{
                  display: { xs: "none", [NAV_DOCKED_BREAKPOINT]: "flex" },
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 1,
                  marginLeft: { [NAV_DOCKED_BREAKPOINT]: "230px" },
                }}
              >
                <AdminTopControls />
                {headerStartContent ? (
                  <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    {headerStartContent}
                  </Box>
                ) : null}
              </Box>
            </Box>
            <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  display: { xs: "none", [NAV_DOCKED_BREAKPOINT]: "flex" },
                  alignItems: "center",
                  gap: 1,
                }}
              >
                {headerEndCluster}
              </Box>
            </Box>
          </>
        )}
        {/* Hamburger – visible while nav is drawer mode (below lg, same as MsqdxAdminNav) */}
        <Box
          sx={{
            position: { xs: "absolute", [NAV_DOCKED_BREAKPOINT]: "static" },
            left: { xs: "1rem", [NAV_DOCKED_BREAKPOINT]: "auto" },
            top: { xs: "7px", [NAV_DOCKED_BREAKPOINT]: "auto" },
            zIndex: 1201
          }}
        >
          <IconButton
            onClick={handleDrawerToggle}
            sx={{
              color: (t) => (t.palette.mode === "dark" ? "#000" : "var(--color-text-primary)"),
              padding: { xs: "16px", [NAV_DOCKED_BREAKPOINT]: "8px" },
              display: { xs: drawerOpen ? "none" : "flex", [NAV_DOCKED_BREAKPOINT]: "none" },
              width: { xs: 64, [NAV_DOCKED_BREAKPOINT]: "auto" },
              height: { xs: 64, [NAV_DOCKED_BREAKPOINT]: "auto" }
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
            display: { xs: drawerOpen ? "none" : "flex", [NAV_DOCKED_BREAKPOINT]: "none" },
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "0 30px 30px 0",
            cursor: "pointer",
            minWidth: 90,
            minHeight: 40,
            position: "absolute",
            left: { xs: 80, [NAV_DOCKED_BREAKPOINT]: -9999 },
            top: { xs: "20px", [NAV_DOCKED_BREAKPOINT]: "66px" },
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
            zIndex: 100_001,
            display: { xs: "block", [NAV_DOCKED_BREAKPOINT]: "none" }
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
            display: { xs: "block", [NAV_DOCKED_BREAKPOINT]: "none" }
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
