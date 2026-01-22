"use client";

import type { ReactNode } from "react";
import { useState, createContext, useContext, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Box, Divider, IconButton, Typography, useTheme } from "@mui/material";
import { BRAND_LOGO } from "../../lib/branding";
import { useThemeMode } from "../theme-registry";
import { MaterialSymbol } from "../material-symbol";
import { MsqdxGlassAdminNav } from "./msqdx-glass-admin-nav";

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
          <Box
            sx={{
              display: "flex",
              minHeight: "100vh",
              position: "relative",
              width: "100%",
              maxWidth: "100vw",
              overflowX: "visible"
            }}
          >
      {/* Sidebar - Outside Container, Full Height */}
      <MsqdxGlassAdminNav 
        open={drawerOpen} 
        onClose={handleDrawerClose}
        currentPath={pathname || ""}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
      />

      {/* Container: Header + Main with Border and Border-Radius */}
      <Box
        className="msqdx-glass-admin-container"
        suppressHydrationWarning
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          minHeight: "100vh",
          position: "relative",
          border: "10px solid var(--audion-light-border-color, #0f172a)",
          borderLeft: { xs: "10px solid var(--audion-light-border-color, #0f172a)", md: 0 },
          borderRadius: "40px",
          backgroundColor: "var(--color-neutral)",
          backgroundImage: themeMode === "dark"
            ? `
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
            `
            : `
              linear-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px)
            `,
          backgroundSize: "20px 20px",
          backgroundAttachment: "fixed",
          overflowX: "visible",
          overflowY: "hidden",
          transition: "border-color 0.3s ease, background-color 0.3s ease"
        }}
      >
        {/* Header Bar */}
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
            justifyContent: "space-between",
            padding: { xs: "0.75rem 1rem", md: "1rem 1.5rem" },
            minHeight: { xs: "56px", md: "64px" },
            backgroundColor: "transparent",
            overflow: "visible",
            borderBottom: 0,
            borderTopLeftRadius: "40px",
            borderTopRightRadius: "40px"
          }}
        >
          {/* L-shaped element with rounded corners - based on provided SVG */}
          <Box
            className="msqdx-glass-admin-header-corner"
            sx={{
              position: "absolute",
              top: "-2px",
              left: { xs: "-203px", md: "-3px" }, // Move -200px left on mobile
              width: "363px",
              height: "135px",
              zIndex: -1,
              pointerEvents: "none",
              overflow: "visible"
            }}
          >
            <svg
              width="363"
              height="135"
              viewBox="0 0 363 135"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                width: "100%",
                height: "100%"
              }}
            >
              <path
                d="M3 120V134.5H0V0H362.5V2H328.5C306.961 2 289.5 19.4609 289.5 41C289.5 62.5391 272.039 80 250.5 80H43C20.9086 80 3 97.9086 3 120Z"
                fill="var(--audion-light-border-color, #0f172a)"
                style={{
                  transition: "fill 0.3s ease"
                }}
              />
            </svg>
          </Box>
          {/* Duplicated SVG for mobile - 60px further right with different fill color */}
          <Box
            className="msqdx-glass-admin-header-corner-duplicate"
            sx={{
              position: "absolute",
              top: "-2px",
              left: { xs: "-120px", md: "-9999px" }, // 10px further left on mobile, hidden on desktop
              width: "363px",
              height: "135px",
              zIndex: -1,
              pointerEvents: "none",
              overflow: "visible",
              display: { xs: "block", md: "none" }
            }}
          >
            <svg
              width="363"
              height="135"
              viewBox="0 0 363 135"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                width: "100%",
                height: "100%"
              }}
            >
              <path
                d="M3 120V134.5H0V0H362.5V2H328.5C306.961 2 289.5 19.4609 289.5 41C289.5 62.5391 272.039 80 250.5 80H43C20.9086 80 3 97.9086 3 120Z"
                fill="var(--color-theme-accent, #b638ff)"
                style={{
                  transition: "fill 0.3s ease",
                  opacity: 0.6
                }}
              />
            </svg>
          </Box>
          {/* Logo - left on desktop, right on mobile */}
          <Box
            sx={{
              position: "absolute",
              top: "22px",
              left: { xs: "auto", md: "-40px" },
              right: { xs: "22px", md: "auto" },
              zIndex: 1200,
              display: "flex",
              alignItems: "flex-start",
              gap: { xs: 1, md: "14px" }
            }}
          >
            <Image
              src={BRAND_LOGO.path}
              alt={BRAND_LOGO.alt}
              width={120}
              height={30}
              priority
              style={{
                height: "auto",
                width: "auto",
                maxWidth: "140px",
                filter: "none"
              }}
            />

            <Divider
              orientation="vertical"
              flexItem
              sx={{
                height: 24,
                borderColor: themeMode === "dark" ? "#000000" : "var(--color-text-primary)",
                display: { xs: "none", md: "block" }
              }}
            />

            <Typography
              variant="h5"
              sx={{
                fontWeight: 300,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontSize: "32px",
                lineHeight: 1,
                marginTop: "-4px",
                color: themeMode === "dark" ? "#000000" : "inherit",
                display: { xs: "none", md: "block" }
              }}
            >
              Audion
            </Typography>
          </Box>
          {/* Right: Page Title + Hamburger (only on mobile when nav closed) */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 1,
              width: "100%"
            }}
          >
            {/* Page Title or Custom Header Content */}
            {headerContent ? (
              <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>
                {headerContent}
              </Box>
            ) : getPageTitle() ? (
              <Typography
                variant="h6"
                sx={{
                  fontSize: "36px",
                  textTransform: "lowercase",
                  fontWeight: 800,
                  marginTop: "-15px",
                  letterSpacing: "-2px",
                  color: "var(--color-text-primary)",
                  display: { xs: "none", md: "block" }
                }}
              >
                {getPageTitle()}
              </Typography>
            ) : null}
          </Box>
          {/* Left: Hamburger button - positioned left on mobile */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: { xs: "0.5rem", md: 0 },
              position: { xs: "absolute", md: "static" },
              left: { xs: "1rem", md: "auto" },
              top: { xs: "7px", md: "auto" },
              zIndex: 1201
            }}
          >
            {/* Hamburger button - positioned left on mobile */}
            <IconButton
              onClick={handleDrawerToggle}
              sx={{
                color: (theme) => theme.palette.mode === "dark" ? "#000000" : "var(--color-text-primary)",
                padding: { xs: "16px", md: "8px" },
                display: { xs: drawerOpen ? "none" : "flex", md: "none" },
                width: { xs: "64px", md: "auto" },
                height: { xs: "64px", md: "auto" }
              }}
              aria-label="Toggle navigation"
            >
              <Box sx={{ fontSize: { xs: 48, md: 32 }, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MaterialSymbol icon="menu" />
              </Box>
            </IconButton>
          </Box>
          
          {/* Panel toggle button - only on mobile, positioned over the duplicated SVG */}
          <Box
            onClick={togglePanel}
            sx={{
              display: { xs: drawerOpen ? "none" : "flex", md: "none" },
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "0 30px 30px 0",
              cursor: "pointer",
              minWidth: "90px",
              minHeight: "40px",
              position: "absolute",
              left: { xs: "80px", md: "-9999px" },
              top: { xs: "20px", md: "66px" },
              zIndex: 1202, // Above the SVG (which has zIndex: -1)
              transition: "opacity 0.2s ease",
              "&:hover": {
                opacity: 0.9
              }
            }}
            aria-label="Toggle panel"
          >
            <Box sx={{ fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center", color: theme.palette.mode === "dark" ? "#ffffff" : "#000000" }}>
              <MaterialSymbol 
                icon={getPageIcon()} 
              />
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
            marginTop: "-76px",
            padding: { xs: "calc(1rem + 76px) 1rem 1rem", md: "calc(1.5rem + 76px) 1.5rem 1.5rem" },
            minWidth: 0,
            maxWidth: "100%",
            width: "100%",
            transition: "padding 0.3s ease"
          }}
        >
          {/* Optional Page Title */}
          {title && (
            <Box sx={{ marginBottom: "1.5rem" }}>
              <Typography variant="h1" sx={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="body1" sx={{ color: "var(--color-text-secondary)" }}>
                  {subtitle}
                </Typography>
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
    </Box>
  );
};

