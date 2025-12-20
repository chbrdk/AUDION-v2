"use client";

import type { ReactNode } from "react";
import "../../styles/admin.css";
import { MsqdxGlassAdminLayoutClient, AdminHeaderProvider, AdminPanelProvider } from "../../components/admin/msqdx-glass-admin-layout";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminHeaderProvider>
      <AdminPanelProvider>
        <MsqdxGlassAdminLayoutClient>
          {children}
        </MsqdxGlassAdminLayoutClient>
      </AdminPanelProvider>
    </AdminHeaderProvider>
  );
}


