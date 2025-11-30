"use client";

import type { ReactNode } from "react";
import "../../styles/admin.css";
import { UdgGlassAdminLayoutClient, AdminHeaderProvider } from "../../components/admin/udg-glass-admin-layout";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminHeaderProvider>
      <UdgGlassAdminLayoutClient>
        {children}
      </UdgGlassAdminLayoutClient>
    </AdminHeaderProvider>
  );
}


