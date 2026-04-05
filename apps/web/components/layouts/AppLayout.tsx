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
  Box
} from "@mui/material";
import { BugReportModal } from "../bug-report/BugReportModal";
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
  const pathname = usePathname();
  const { themeMode, toggleTheme } = useThemeMode();

  const handleOpenBugModal = () => setBugModalOpen(true);
  const handleCloseBugModal = () => {
    setBugModalOpen(false);
  };

  const handleSubmitBug = (description: string) => {
    // TODO: Send bug report to API
    console.log("Bug Report Submitted:", description);
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
      innerBackground="offwhite"
    >
      { }
      {children as any}

      <BugReportModal 
        open={bugModalOpen} 
        onClose={handleCloseBugModal} 
        onSubmit={handleSubmitBug} 
      />
    </MsqdxAppLayout>
  );
}
