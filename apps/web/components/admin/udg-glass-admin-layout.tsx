"use client";

import type { ReactNode } from "react";
import { useState, createContext, useContext, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Box, Divider, IconButton, Typography } from "@mui/material";
import { BRAND_LOGO } from "../../lib/branding";
import { useThemeMode } from "../theme-registry";
import { MaterialSymbol } from "../material-symbol";
import { UdgGlassAdminNav } from "./udg-glass-admin-nav";

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

export type UdgGlassAdminLayoutClientProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

export const UdgGlassAdminLayoutClient = ({ children, title, subtitle }: UdgGlassAdminLayoutClientProps) => {
  const [drawerOpen, setDrawerOpen] = useState(true); // Default open on desktop
  const pathname = usePathname();
  const { themeMode, toggleTheme } = useThemeMode();
  // Get headerContent from context - safe for SSR with default value
  const { headerContent } = useAdminHeader();

  const handleDrawerToggle = () => {
    setDrawerOpen((prev) => !prev);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
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
      <UdgGlassAdminNav 
        open={drawerOpen} 
        onClose={handleDrawerClose}
        currentPath={pathname || ""}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
      />

      {/* Container: Header + Main with Border and Border-Radius */}
      <Box
        className="udg-glass-admin-container"
        suppressHydrationWarning
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          minHeight: "100vh",
          position: "relative",
          border: "10px solid var(--audion-light-border-color, #0f172a)",
          borderLeft: 0,
          borderRadius: "40px",
          backgroundColor: "var(--color-neutral)",
          backgroundImage: themeMode === "dark"
            ? `
              linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
            `
            : `
              linear-gradient(rgba(15, 23, 42, 0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px)
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
          className="udg-glass-admin-header-bar"
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
            className="udg-glass-admin-header-corner"
            sx={{
              position: "absolute",
              top: "-2px",
              left: "-3px",
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
          {/* Left: Logo - positioned absolutely over sidebar */}
          <Box
            sx={{
              position: "absolute",
              top: "22px",
              left: "-38px",
              zIndex: 1200,
              display: "flex",
              alignItems: "flex-start",
              gap: { xs: 1, md: 1.75 }
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
                filter: themeMode === "dark" ? "invert(0)" : "none"
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
                  textShadow: "4px 4px 0 var(--color-theme-accent)",
                  display: { xs: "none", md: "block" }
                }}
              >
                {getPageTitle()}
              </Typography>
            ) : null}
            {/* Hamburger only visible on mobile when drawer is closed */}
            <IconButton
              onClick={handleDrawerToggle}
              sx={{
                color: "var(--color-text-primary)",
                padding: "8px",
                display: { xs: drawerOpen ? "none" : "flex", md: "none" }
              }}
              aria-label="Toggle navigation"
            >
              <MaterialSymbol icon="menu" fontSize={24} />
            </IconButton>
          </Box>
        </Box>

        {/* Content Area */}
        <Box
          component="main"
          className="udg-glass-admin-content"
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

      {/* Mobile Overlay */}
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
    </Box>
  );
};

