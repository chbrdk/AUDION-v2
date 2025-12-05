"use client";

import type { ReactNode } from "react";
import "../../styles/admin.css";
import { UdgGlassAdminLayoutClient, AdminHeaderProvider, AdminPanelProvider } from "../../components/admin/udg-glass-admin-layout";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminHeaderProvider>
      <AdminPanelProvider>
        <UdgGlassAdminLayoutClient>
          {children}
        </UdgGlassAdminLayoutClient>
      </AdminPanelProvider>
    </AdminHeaderProvider>
  );
}


