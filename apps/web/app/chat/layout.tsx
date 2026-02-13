"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import "../../styles/admin.css";
import { AuthProvider } from "../../components/auth/auth-provider";
import { ProjectProvider } from "../../components/projects/project-provider";
import { ThemeRegistryNoSSR } from "../../components/theme-registry-no-ssr";
import { useI18n } from "../../components/i18n/i18n-provider";

const ChatLayoutClient = dynamic(
  () =>
    import("../../components/chat/chat-share-layout").then((m) => ({
      default: m.ChatShareLayout,
    })),
  { ssr: false }
);

function ChatLayoutLoadingFallback() {
  const { t } = useI18n();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {t("common.loading")}
    </div>
  );
}

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeRegistryNoSSR>
      <AuthProvider>
        <ProjectProvider>
          <Suspense fallback={<ChatLayoutLoadingFallback />}>
            <ChatLayoutClient>{children}</ChatLayoutClient>
          </Suspense>
        </ProjectProvider>
      </AuthProvider>
    </ThemeRegistryNoSSR>
  );
}
