"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import "../../styles/admin.css";
import { AdminHeaderProvider, AdminPanelProvider } from "../../components/admin/admin-layout-providers";
import { AuthProvider } from "../../components/auth/auth-provider";
import { ProjectProvider } from "../../components/projects/project-provider";
import { AuthLocaleSync } from "../../components/i18n/auth-locale-sync";
import { useI18n } from "../../components/i18n/i18n-provider";

const AdminLoadingFallback = () => {
  const { t } = useI18n();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#0f0f0f",
        color: "#fff",
      }}
    >
      {t("common.loading")}
    </div>
  );
};

// Dynamic import to avoid "Cannot access 'i' before initialization" (TDZ/circular import)
// when loading @msqdx/react in the same chunk as the layout. The layout client imports
// MsqdxAppLayout, MsqdxAdminNav, etc. from @msqdx/react – deferring this breaks the cycle.
const MsqdxGlassAdminLayoutClient = dynamic(
  () =>
    import("../../components/admin/msqdx-glass-admin-layout").then((m) => ({
      default: m.MsqdxGlassAdminLayoutClient,
    })),
  {
    ssr: false,
    loading: () => <AdminLoadingFallback />,
  }
);

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthLocaleSync />
      <ProjectProvider>
        <AdminHeaderProvider>
          <AdminPanelProvider>
            <MsqdxGlassAdminLayoutClient>
              {children}
            </MsqdxGlassAdminLayoutClient>
          </AdminPanelProvider>
        </AdminHeaderProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}
