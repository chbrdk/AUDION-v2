"use client";

import { ReactNode, useEffect, useState } from "react";
import { ThemeRegistry } from "../components/theme-registry";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return <ThemeRegistry>{children}</ThemeRegistry>;
}
