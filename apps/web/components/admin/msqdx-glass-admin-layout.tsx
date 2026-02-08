"use client";

import type { ReactNode } from "react";
import { useState, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, IconButton, useTheme } from "@mui/material";
import { useThemeMode } from "../theme-registry";
import { MsqdxIcon, MsqdxAdminNav, MsqdxAppLayout, MsqdxTypography } from "@msqdx/react";
import type { AdminNavItem } from "@msqdx/react";

// Context für benutzerdefinierten Header-Content
// Use a default value to avoid SSR issues
const defaultHeaderContext: {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
} = {
  headerContent: null,
  setHeaderContent: () => {}
};

const AdminHeaderContext = createContext<{
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
}>(defaultHeaderContext);

export const useAdminHeader = () => {
  return useContext(AdminHeaderContext);
};

export const AdminHeaderProvider = ({ children }: { children: ReactNode }) => {
  // Use useState with null initial value - safe for SSR
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null);

  return (
    <AdminHeaderContext.Provider value={{ headerContent, setHeaderContent }}>
      {children}
    </AdminHeaderContext.Provider>
  );
};

// Context für Panel-State (Mobile Off-Canvas)
const defaultPanelContext: {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
} = {
  panelOpen: false,
  setPanelOpen: () => {},
  togglePanel: () => {}
};

const AdminPanelContext = createContext<{
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
}>(defaultPanelContext);

export const useAdminPanel = () => {
  return useContext(AdminPanelContext);
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Dashboard", path: "/admin", icon: "dashboard", exact: true },
  { label: "Personas", path: "/admin/personas", icon: "person" },
  { label: "Target Groups", path: "/admin/target-groups", icon: "groups" },
  { label: "Journeys", path: "/admin/journeys", icon: "route" },
  { label: "Queue", path: "/admin/queue", icon: "view_list" },
  { label: "Chat", path: "/admin/chat", icon: "forum" },
  { label: "Chat History", path: "/admin/chat/history", icon: "history" },
  { label: "Settings", path: "/admin/settings", icon: "settings" },
];

export const AdminPanelProvider = ({ children }: { children: ReactNode }) => {
  const [panelOpen, setPanelOpen] = useState(false);

  const togglePanel = () => {
    setPanelOpen((prev) => !prev);
  };

  return (
    <AdminPanelContext.Provider value={{ panelOpen, setPanelOpen, togglePanel }}>
      {children}
    </AdminPanelContext.Provider>
  );
};

export type MsqdxGlassAdminLayoutClientProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

export const MsqdxGlassAdminLayoutClient = ({ children, title, subtitle }: MsqdxGlassAdminLayoutClientProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false); // Default open on desktop
  const pathname = usePathname();
  const theme = useTheme();
  const { themeMode, toggleTheme } = useThemeMode();
  // Get headerContent from context - safe for SSR with default value
  const { headerContent } = useAdminHeader();
  // Get panel state from context
  const { panelOpen, togglePanel, setPanelOpen } = useAdminPanel();

  const handleDrawerToggle = () => {
    setDrawerOpen((prev) => !prev);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const handlePanelClose = () => {
    setPanelOpen(false);
  };

  // Get page title from pathname
  const getPageTitle = () => {
    if (!pathname) return "";
    
    const pathMap: Record<string, string> = {
      "/admin": "Dashboard",
      "/admin/personas": "Personas",
      "/admin/target-groups": "Target Groups",
      "/admin/journeys": "Journeys",
      "/admin/queue": "Queue",
      "/admin/chat": "Chat",
      "/admin/settings": "Settings",
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
      "/admin/personas": "person",
      "/admin/target-groups": "groups",
      "/admin/journeys": "route",
      "/admin/queue": "view_list",
      "/admin/chat": "forum",
      "/admin/chat/history": "history",
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
    <MsqdxAppLayout
      sidebar={
        <MsqdxAdminNav
          open={drawerOpen}
          onClose={handleDrawerClose}
          currentPath={pathname || ""}
          items={ADMIN_NAV_ITEMS}
          externalItems={[]}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          linkComponent={Link as any}
          brandColor="black"
        />
      }
      logo
      appName="Audion"
      brandColor="black"
      innerBackground="grid"
      borderWidth="thick"
    >
      {/* Header Bar – Page Title, Hamburger, Panel Toggle (Logo/Corner via MsqdxAppLayout) */}
      <Box
        component="header"
        className="msqdx-glass-admin-header-bar"
        suppressHydrationWarning
        sx={{
          position: "sticky",
          top: 0,
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
        {/* Page Title or Custom Header Content */}
        <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          {headerContent ? (
            <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>
              {headerContent}
            </Box>
          ) : getPageTitle() ? (
            <MsqdxTypography
              variant="h4"
              sx={{
                fontSize: { xs: "1.5rem", md: "36px" },
                textTransform: "lowercase",
                fontWeight: 800,
                letterSpacing: "-2px",
                color: "text.primary",
                display: { xs: "none", md: "block" }
              }}
            >
              {getPageTitle()}
            </MsqdxTypography>
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
            aria-label="Toggle navigation"
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
          aria-label="Toggle panel"
        >
          <Box sx={{ color: theme.palette.mode === "dark" ? "#fff" : "#000" }}>
            <MsqdxIcon name={getPageIcon()} customSize={32} />
          </Box>
        </Box>
      </Box>

      {/* Content Area */}
      <Box
        component="main"
        className="msqdx-glass-admin-content"
        suppressHydrationWarning
        sx={{
          flex: 1,
          overflowX: "hidden",
          overflowY: "auto",
          padding: { xs: "1rem", md: "1.5rem" },
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
  );
};

