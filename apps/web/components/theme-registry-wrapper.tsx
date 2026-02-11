"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";

// Load ThemeRegistry only client-side to avoid useContext during prerendering
const ThemeRegistry = dynamic(
  () => import("./theme-registry").then((mod) => ({ default: mod.ThemeRegistry })),
  { ssr: false }
);

export function ThemeRegistryWrapper({ children }: { children: ReactNode }) {
  return <ThemeRegistry>{children}</ThemeRegistry>;
}
