"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Divider, IconButton, List, ListItem, ListItemButton, Typography, useMediaQuery, useTheme } from "@mui/material";
import clsx from "clsx";
import { MaterialSymbol } from "../material-symbol";

export type UdgGlassAdminNavProps = {
  open: boolean;
  onClose: () => void;
  currentPath: string;
  themeMode?: "light" | "dark";
  onToggleTheme?: () => void;
};

type NavItem = {
  label: string;
  path: string;
  icon: string;
  external?: boolean;
};

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: "dashboard" },
  { label: "Personas", path: "/admin/personas", icon: "person" },
  { label: "Target Groups", path: "/admin/target-groups", icon: "groups" },
  { label: "Journeys", path: "/admin/journeys", icon: "route" },
  { label: "Queue", path: "/admin/queue", icon: "view_list" },
  { label: "Chat", path: "/admin/chat", icon: "forum" },
  { label: "Chat History", path: "/admin/chat/history", icon: "history" },
  { label: "Settings", path: "/admin/settings", icon: "settings" }
];

const externalNavItems: NavItem[] = [];

export const UdgGlassAdminNav = ({ open, onClose, currentPath, themeMode, onToggleTheme }: UdgGlassAdminNavProps) => {
  const pathname = usePathname();
  const theme = useTheme();
  // useMediaQuery with noSsr option to prevent hydration mismatch
  const isMobile = useMediaQuery(theme.breakpoints.down("md"), { noSsr: true }); // < 960px
  const [expanded, setExpanded] = useState(false); // Expanded state for desktop
  const [mounted, setMounted] = useState(false);

  // Ensure we only render client-side differences after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return pathname === "/admin";
    }
    return pathname?.startsWith(path) ?? false;
  };

  const handleItemClick = () => {
    // Close drawer on mobile after navigation
    if (mounted && isMobile) {
      onClose();
    }
  };

  const handleToggleExpand = () => {
    setExpanded((prev) => !prev);
  };

  // On mobile, expanded state follows open state (always expanded when open)
  // On desktop, use the expanded state
  // Use mounted check to ensure SSR consistency - default to false (collapsed) on server
  const isExpanded = mounted && isMobile ? open : (mounted ? expanded : false);
  const sidebarWidth = isExpanded ? { xs: "95%", md: "240px" } : { xs: "95%", md: "64px" };

  return (
    <>
      {/* Desktop Persistent Drawer / Mobile Temporary Drawer */}
      <Box
        component="nav"
        className="udg-glass-admin-nav"
          sx={{
            position: { xs: "fixed", md: "relative" },
            top: { xs: 0, md: 0 },
            left: 0,
            height: { xs: "100vh", md: "100vh" }, // Full viewport height
            width: sidebarWidth,
            borderRight: "1px solid var(--audion-light-border-color, #0f172a)",
            backgroundColor: "var(--audion-light-border-color, #0f172a)",
            transform: { 
              xs: open ? "translateX(0)" : "translateX(-100%)",
              md: "translateX(0)" // Always visible on desktop
            },
            transition: "width 0.3s ease, transform 0.3s ease",
            zIndex: { xs: 1200, md: "auto" },
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: isExpanded ? "stretch" : "center",
            justifyContent: "center",
            padding: isExpanded ? "0.75rem 0.5rem" : "0.75rem 0"
          }}
      >
        {/* Close Button - Top Right (mobile only) */}
        {mounted && isMobile && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "0.5rem",
              paddingTop: "1rem"
            }}
          >
            <IconButton
              onClick={onClose}
              sx={{
                color: "var(--audion-sidebar-text-color, rgba(255, 255, 255, 0.9))",
                padding: { xs: "1.5rem", md: "0.5rem" },
                width: { xs: "96px", md: "40px" },
                height: { xs: "96px", md: "40px" },
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)"
                },
                transition: "all 0.2s ease"
              }}
              aria-label="Close navigation"
            >
              <MaterialSymbol icon="close" fontSize={{ xs: 56, md: 20 }} />
            </IconButton>
          </Box>
        )}
        {/* Navigation Items */}
        <List
          sx={{
            padding: 0,
            flex: 1,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: isExpanded ? "stretch" : "center",
            justifyContent: "center",
            gap: "0.125rem"
          }}
        >
          {/* Hamburger Menu Button - nur auf Desktop, als erstes Item */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              justifyContent: isExpanded ? "flex-start" : "center",
              width: "100%",
              padding: "0 0.25rem",
              marginBottom: "0.125rem"
            }}
          >
            <IconButton
              onClick={handleToggleExpand}
              sx={{
                color: "var(--audion-sidebar-text-color, rgba(255, 255, 255, 0.9))",
                padding: { xs: "1rem", md: "0.5rem" },
                width: isExpanded ? "calc(100% - 0.5rem)" : { xs: "60px", md: "40px" },
                height: { xs: "60px", md: "40px" },
                display: "flex",
                alignItems: "center",
                justifyContent: isExpanded ? "flex-start" : "center",
                borderRadius: "8px",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)"
                },
                transition: "all 0.2s ease"
              }}
              aria-label={isExpanded ? "Collapse navigation" : "Expand navigation"}
            >
              <MaterialSymbol 
                icon={isExpanded ? "menu_open" : "menu"} 
                fontSize={{ xs: 28, md: 20 }} 
                style={{ marginRight: isExpanded ? (isMobile ? "1rem" : "0.75rem") : 0 }}
              />
              {isExpanded && (
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: { xs: "1.125rem", md: "0.8125rem" },
                    color: "inherit",
                    whiteSpace: "nowrap"
                  }}
                >
                  Menu
                </Typography>
              )}
            </IconButton>
          </Box>
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <ListItem key={item.path} disablePadding sx={{ width: "100%", display: "flex", justifyContent: isExpanded ? "stretch" : "center" }} suppressHydrationWarning>
                <ListItemButton
                  component={Link}
                  href={item.path}
                  onClick={handleItemClick}
                  className={clsx("udg-glass-admin-nav-item", active && "--active")}
                  suppressHydrationWarning
                  sx={{
                    padding: isExpanded ? { xs: "1rem 1.5rem", md: "0.5rem 1rem" } : { xs: "1rem", md: "0.5rem" },
                    margin: 0,
                    borderRadius: "8px",
                    minWidth: "auto",
                    width: isExpanded ? "calc(100% - 0.5rem)" : { xs: "60px", md: "40px" },
                    height: { xs: "60px", md: "40px" },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: isExpanded ? "flex-start" : "center",
                    backgroundColor: active ? "rgba(255, 255, 255, 0.15)" : "transparent",
                    color: active 
                      ? "var(--audion-sidebar-text-color, #ffffff)" 
                      : "color-mix(in srgb, var(--audion-sidebar-text-color, #ffffff) 70%, transparent)",
                    border: "none",
                    "&:hover": {
                      backgroundColor: active ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.1)",
                      color: "var(--audion-sidebar-text-color, #ffffff)"
                    },
                    transition: "all 0.2s ease"
                  }}
                  title={!isExpanded ? item.label : undefined} // Tooltip nur wenn collapsed
                >
                  <MaterialSymbol 
                    icon={item.icon} 
                    fontSize={{ xs: 28, md: 20 }} 
                    style={{ marginRight: isExpanded ? (isMobile ? "1rem" : "0.75rem") : 0 }}
                  />
                  {isExpanded && (
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: active ? 600 : 400,
                        fontSize: { xs: "1.125rem", md: "0.8125rem" },
                        color: "inherit",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {item.label}
                    </Typography>
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}

          {/* Separator */}
          <Divider 
            sx={{ 
              marginY: "0.25rem",
              width: isExpanded ? "calc(100% - 1rem)" : "80%",
              borderColor: "rgba(255, 255, 255, 0.2)",
              alignSelf: "center"
            }} 
          />

          {/* External Links */}
          {externalNavItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ width: "100%", display: "flex", justifyContent: isExpanded ? "stretch" : "center" }}>
              <ListItemButton
                component={Link}
                href={item.path}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
                onClick={handleItemClick}
                sx={{
                  padding: isExpanded ? { xs: "1rem 1.5rem", md: "0.5rem 1rem" } : { xs: "1rem", md: "0.5rem" },
                  margin: 0,
                  borderRadius: "8px",
                  minWidth: "auto",
                  width: isExpanded ? "calc(100% - 0.5rem)" : { xs: "60px", md: "40px" },
                  height: { xs: "60px", md: "40px" },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isExpanded ? "flex-start" : "center",
                  color: "color-mix(in srgb, var(--audion-sidebar-text-color, #ffffff) 70%, transparent)",
                  border: "none",
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    color: "var(--audion-sidebar-text-color, #ffffff)"
                  },
                  transition: "all 0.2s ease"
                }}
                title={!isExpanded ? item.label : undefined}
              >
                <MaterialSymbol 
                  icon={item.icon} 
                  fontSize={{ xs: 28, md: 20 }} 
                  style={{ marginRight: isExpanded ? (isMobile ? "1rem" : "0.75rem") : 0 }}
                />
                {isExpanded && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontSize: { xs: "1.125rem", md: "0.8125rem" },
                      color: "inherit",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {item.label}
                  </Typography>
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {/* Theme Toggle Button - Bottom Left */}
        {onToggleTheme && (
          <Box
            sx={{
              display: "flex",
              justifyContent: isExpanded ? "flex-start" : "center",
              padding: "0.5rem",
              marginTop: "auto",
              paddingBottom: "1rem"
            }}
          >
            <IconButton
              onClick={onToggleTheme}
              sx={{
                color: "var(--audion-sidebar-text-color, rgba(255, 255, 255, 0.9))",
                padding: { xs: "1rem", md: "0.5rem" },
                width: isExpanded ? "calc(100% - 0.5rem)" : { xs: "60px", md: "40px" },
                height: { xs: "60px", md: "40px" },
                display: "flex",
                alignItems: "center",
                justifyContent: isExpanded ? "flex-start" : "center",
                borderRadius: "8px",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)"
                },
                transition: "all 0.2s ease"
              }}
              aria-label="Toggle theme"
            >
              <MaterialSymbol 
                icon={themeMode === "dark" ? "light_mode" : "dark_mode"} 
                fontSize={{ xs: 28, md: 20 }} 
                style={{ marginRight: isExpanded ? (isMobile ? "1rem" : "0.75rem") : 0 }}
              />
              {isExpanded && (
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: { xs: "1.125rem", md: "0.8125rem" },
                    color: "inherit",
                    whiteSpace: "nowrap"
                  }}
                >
                  {themeMode === "dark" ? "Light Mode" : "Dark Mode"}
                </Typography>
              )}
            </IconButton>
          </Box>
        )}
      </Box>
    </>
  );
};

