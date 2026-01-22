"use client";

import { ReactNode } from "react";
import { ThemeRegistrySSRSafe } from "./theme-registry-ssr-safe";

export function ThemeRegistryNoSSR({ children }: { children: ReactNode }) {
  // This component only renders ThemeRegistrySSRSafe in the browser
  // During SSR, it returns children directly to avoid any MUI useContext errors
  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  return <ThemeRegistrySSRSafe>{children}</ThemeRegistrySSRSafe>;
}
