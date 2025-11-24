"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Box, Divider, IconButton, Typography } from "@mui/material";
import { BRAND_LOGO } from "../../lib/branding";
import { useThemeMode } from "../theme-registry";
import { MaterialSymbol } from "../material-symbol";
import { UdgGlassAdminNav } from "./udg-glass-admin-nav";

export type UdgGlassAdminLayoutClientProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

export const UdgGlassAdminLayoutClient = ({ children, title, subtitle }: UdgGlassAdminLayoutClientProps) => {
  const [drawerOpen, setDrawerOpen] = useState(true); // Default open on desktop
  const pathname = usePathname();
  const { themeMode, toggleTheme } = useThemeMode();

  const handleDrawerToggle = () => {
    setDrawerOpen((prev) => !prev);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        position: "relative",
        width: "100%",
        maxWidth: "100vw",
        overflowX: "hidden"
      }}
    >
      {/* Header Bar */}
      <Box
        component="header"
        className="udg-glass-admin-header-bar"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: { xs: "0.75rem 1rem", md: "1rem 1.5rem" },
          borderBottom: "1px solid var(--color-secondary-dx-purple)",
          minHeight: { xs: "56px", md: "64px" }
        }}
      >
        {/* Left: Logo */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 1, md: 1.75 }
          }}
        >
          <Image
            src={BRAND_LOGO.path}
            alt={BRAND_LOGO.alt}
            width={180}
            height={44}
            priority
            style={{
              height: "auto",
              width: "auto",
              maxWidth: "220px",
              filter: themeMode === "dark" ? "invert(1)" : "none"
            }}
          />

          <Divider
            orientation="vertical"
            flexItem
            sx={{
              height: 36,
              borderColor: "var(--color-neutral)",
              display: { xs: "none", md: "block" }
            }}
          />

          <Typography
            variant="h4"
            sx={{
              fontWeight: 300,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              display: { xs: "none", md: "block" }
            }}
          >
            Audion
          </Typography>
        </Box>

        {/* Right: Hamburger (only on mobile when nav closed) + Theme Toggle */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1
          }}
        >
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

          <IconButton
            onClick={toggleTheme}
            sx={{
              color: "var(--color-text-primary)",
              padding: "8px"
            }}
            aria-label="Toggle theme"
          >
            <MaterialSymbol 
              icon={themeMode === "dark" ? "light_mode" : "dark_mode"} 
              fontSize={24} 
            />
          </IconButton>
        </Box>
      </Box>

      {/* Main Layout: Drawer + Content */}
      <Box
        sx={{
          display: "flex",
          flex: 1,
          position: "relative",
          overflow: "hidden",
          minWidth: 0
        }}
      >
        {/* Off-Canvas Navigation Drawer */}
        <UdgGlassAdminNav 
          open={drawerOpen} 
          onClose={handleDrawerClose}
          currentPath={pathname || ""}
        />

        {/* Content Area */}
        <Box
          component="main"
          className="udg-glass-admin-content"
          sx={{
            flex: 1,
            overflowX: "hidden",
            overflowY: "auto",
            padding: { xs: "1rem", md: "1.5rem 1.5rem 1.5rem 0" },
            minWidth: 0,
            maxWidth: "100%",
            width: "100%"
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

