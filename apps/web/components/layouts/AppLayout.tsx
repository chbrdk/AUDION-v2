"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MsqdxAppLayout, MsqdxAdminNav } from "@msqdx/react";
import type { AdminNavItem } from "@msqdx/react";
import { useThemeMode } from "../theme-registry";
import { BRAND_COLOR } from "../../lib/branding";
import "../../styles/admin.css";

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

export type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { themeMode, toggleTheme } = useThemeMode();

  return (
    <MsqdxAppLayout
      sidebar={
        <MsqdxAdminNav
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          currentPath={pathname ?? ""}
          items={ADMIN_NAV_ITEMS}
          externalItems={[]}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          linkComponent={Link as any}
          brandColor={BRAND_COLOR}
        />
      }
      brandColor={BRAND_COLOR}
      innerBackground="grid"
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {children as any}
    </MsqdxAppLayout>
  );
}
