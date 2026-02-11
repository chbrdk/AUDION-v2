"use client";

import type { ReactNode} from "react";
import { useEffect, useState } from "react";
import { ThemeRegistry } from "./theme-registry";

export function ThemeRegistryClient({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render ThemeRegistry during SSR/prerendering
  if (!mounted) {
    return <>{children}</>;
  }

  return <ThemeRegistry>{children}</ThemeRegistry>;
}
