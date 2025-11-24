"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Divider, List, ListItem, ListItemButton, Typography } from "@mui/material";
import clsx from "clsx";
import { MaterialSymbol } from "../material-symbol";

export type UdgGlassAdminNavProps = {
  open: boolean;
  onClose: () => void;
  currentPath: string;
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
  { label: "Queue", path: "/admin/queue", icon: "view_list" },
  { label: "API Docs", path: "/admin/api-docs", icon: "description" }
];

const externalNavItems: NavItem[] = [
  { label: "Chat", path: "/chat", icon: "forum" }
];

export const UdgGlassAdminNav = ({ open, onClose, currentPath }: UdgGlassAdminNavProps) => {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/admin") {
      return pathname === "/admin";
    }
    return pathname?.startsWith(path) ?? false;
  };

  const handleItemClick = () => {
    // Close drawer on mobile after navigation
    if (window.innerWidth < 960) {
      onClose();
    }
  };

  return (
    <>
      {/* Desktop Persistent Drawer / Mobile Temporary Drawer */}
      <Box
        component="nav"
        className="udg-glass-admin-nav"
        sx={{
          position: { xs: "fixed", md: "relative" },
          top: { xs: 0, md: "auto" },
          left: 0,
          height: { xs: "100vh", md: "100%" },
          width: { xs: "240px", md: "200px" },
          borderRight: "1px solid var(--color-secondary-dx-purple)",
          backgroundColor: "var(--color-primary-white)",
          transform: { 
            xs: open ? "translateX(0)" : "translateX(-100%)",
            md: "translateX(0)" // Always visible on desktop
          },
          transition: "transform 0.3s ease",
          zIndex: { xs: 1200, md: "auto" },
          overflowY: "auto",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Navigation Items */}
        <List
          sx={{
            padding: "0.75rem 0",
            flex: 1,
            width: "100%"
          }}
        >
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  component={Link}
                  href={item.path}
                  onClick={handleItemClick}
                  className={clsx("udg-glass-admin-nav-item", active && "--active")}
                  sx={{
                    padding: "0.5rem 0.75rem",
                    marginX: "0.5rem",
                    marginY: "0.125rem",
                    borderRadius: "8px",
                    border: active ? "1px solid var(--color-secondary-dx-purple)" : "1px solid transparent",
                    backgroundColor: active ? "rgba(182, 56, 255, 0.1)" : "transparent",
                    color: active ? "var(--color-secondary-dx-purple)" : "var(--color-text-primary)",
                    minWidth: "auto",
                    width: "calc(100% - 1rem)",
                    "&:hover": {
                      backgroundColor: active ? "rgba(182, 56, 255, 0.15)" : "rgba(0, 0, 0, 0.05)",
                    },
                    transition: "all 0.2s ease"
                  }}
                >
                  <MaterialSymbol 
                    icon={item.icon} 
                    fontSize={18} 
                    style={{ marginRight: "0.5rem" }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: active ? 600 : 400,
                      fontSize: "0.875rem"
                    }}
                  >
                    {item.label}
                  </Typography>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {/* Separator */}
        <Divider sx={{ marginY: "0.5rem" }} />

        {/* External Links */}
        <List
          sx={{
            padding: "0.75rem 0",
            paddingBottom: "1.5rem",
            width: "100%"
          }}
        >
          {externalNavItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={Link}
                href={item.path}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
                onClick={handleItemClick}
                sx={{
                  padding: "0.5rem 0.75rem",
                  marginX: "0.5rem",
                  marginY: "0.125rem",
                  borderRadius: "8px",
                  color: "var(--color-text-secondary)",
                  minWidth: "auto",
                  width: "calc(100% - 1rem)",
                  "&:hover": {
                    backgroundColor: "rgba(0, 0, 0, 0.05)",
                    color: "var(--color-text-primary)"
                  },
                  transition: "all 0.2s ease"
                }}
              >
                <MaterialSymbol 
                  icon={item.icon} 
                  fontSize={18} 
                  style={{ marginRight: "0.5rem" }}
                />
                <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                  {item.label}
                </Typography>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </>
  );
};

