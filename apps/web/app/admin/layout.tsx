import type { ReactNode } from "react";
import "../../styles/admin.css";
import { UdgGlassAdminLayoutClient } from "../../components/admin/udg-glass-admin-layout";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <UdgGlassAdminLayoutClient>
      {children}
    </UdgGlassAdminLayoutClient>
  );
}


