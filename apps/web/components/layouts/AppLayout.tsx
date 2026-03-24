"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  MsqdxAppLayout, 
  MsqdxAdminNav,
  MsqdxTypography 
} from "@msqdx/react";
import type { AdminNavItem } from "@msqdx/react";
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Button,
  Box
} from "@mui/material";
import { useThemeMode } from "../theme-registry";
import { THEME_ACCENT_WITH_FALLBACK } from "../../lib/theme-accent";
import "../../styles/admin.css";

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Dashboard", path: "/admin", icon: "dashboard", exact: true },
  { label: "Personas", path: "/admin/personas", icon: "person" },
  { label: "Target Groups", path: "/admin/target-groups", icon: "groups" },
  { label: "Journeys", path: "/admin/journeys", icon: "route" },
  { label: "Queue", path: "/admin/queue", icon: "view_list" },
  { label: "Chat", path: "/admin/chat", icon: "forum" },
  { label: "Chat History", path: "/admin/chat/history", icon: "history" },
  { label: "Profile", path: "/admin/profile", icon: "account_circle" },
];

export type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const [bugDescription, setBugDescription] = useState("");
  const pathname = usePathname();
  const { themeMode, toggleTheme } = useThemeMode();

  const handleOpenBugModal = () => setBugModalOpen(true);
  const handleCloseBugModal = () => {
    setBugModalOpen(false);
    setBugDescription("");
  };

  const handleSubmitBug = () => {
    // TODO: Send bug report to API
    console.log("Bug Report Submitted:", bugDescription);
    handleCloseBugModal();
    // Maybe show a success toast here
  };

  const EXTERNAL_NAV_ITEMS: AdminNavItem[] = [
    { label: "Settings", path: "/admin/settings", icon: "settings" },
    { 
      label: "Bug Report", 
      icon: "bug_report", 
      onClick: handleOpenBugModal 
    },
  ];

  return (
    <MsqdxAppLayout
      sidebar={
        <MsqdxAdminNav
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          currentPath={pathname ?? ""}
          items={ADMIN_NAV_ITEMS}
          externalItems={EXTERNAL_NAV_ITEMS}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          linkComponent={Link as any}
          sx={{
            backgroundColor: THEME_ACCENT_WITH_FALLBACK.backgroundColor,
            borderRightColor: THEME_ACCENT_WITH_FALLBACK.borderColor,
          }}
        />
      }
      sx={{
        "& .msqdx-app-layout__sidebar": {
          backgroundColor: THEME_ACCENT_WITH_FALLBACK.backgroundColor,
          borderRightColor: THEME_ACCENT_WITH_FALLBACK.borderColor,
        },
        "& > div:last-of-type": {
          backgroundColor: `${THEME_ACCENT_WITH_FALLBACK.backgroundColor} !important`,
        },
        "& > div:last-of-type > div": {
          borderColor: `${THEME_ACCENT_WITH_FALLBACK.borderColor} !important`,
        },
      }}
      innerBackground="grid"
    >
      { }
      {children as any}

      <Dialog 
        open={bugModalOpen} 
        onClose={handleCloseBugModal}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: "16px",
            backgroundColor: THEME_ACCENT_WITH_FALLBACK.backgroundColor,
            border: `1px solid ${THEME_ACCENT_WITH_FALLBACK.borderColor}`,
            backgroundImage: "none",
          }
        }}
      >
        <DialogTitle sx={{ color: "white" }}>
          Report a Bug
        </DialogTitle>
        <DialogContent>
          <MsqdxTypography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)", mb: 2 }}>
            Describe the issue you encountered. Please include steps to reproduce if possible.
          </MsqdxTypography>
          <TextField
            autoFocus
            multiline
            rows={4}
            fullWidth
            placeholder="Type your bug description here..."
            variant="outlined"
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "white",
                "& fieldset": {
                  borderColor: "rgba(255, 255, 255, 0.2)",
                },
                "&:hover fieldset": {
                  borderColor: "rgba(255, 255, 255, 0.3)",
                },
                "&.Mui-focused fieldset": {
                  borderColor: THEME_ACCENT_WITH_FALLBACK.borderColor,
                },
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseBugModal} sx={{ color: "rgba(255, 255, 255, 0.5)" }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitBug} 
            disabled={!bugDescription.trim()}
            variant="contained"
            sx={{ 
                backgroundColor: THEME_ACCENT_WITH_FALLBACK.borderColor,
                "&:hover": {
                    backgroundColor: THEME_ACCENT_WITH_FALLBACK.borderColor,
                    opacity: 0.8
                }
            }}
          >
            Submit Report
          </Button>
        </DialogActions>
      </Dialog>
    </MsqdxAppLayout>
  );
}
