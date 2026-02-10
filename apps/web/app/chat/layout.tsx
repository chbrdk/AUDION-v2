"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import "../../styles/admin.css";
import { AuthProvider } from "../../components/auth/auth-provider";
import { ProjectProvider } from "../../components/projects/project-provider";
import { ThemeRegistryNoSSR } from "../../components/theme-registry-no-ssr";

const ChatLayoutClient = dynamic(
  () =>
    import("../../components/chat/chat-share-layout").then((m) => ({
      default: m.ChatShareLayout,
    })),
  { ssr: false }
);

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeRegistryNoSSR>
      <AuthProvider>
        <ProjectProvider>
          <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading…</div>}>
            <ChatLayoutClient>{children}</ChatLayoutClient>
          </Suspense>
        </ProjectProvider>
      </AuthProvider>
    </ThemeRegistryNoSSR>
  );
}
