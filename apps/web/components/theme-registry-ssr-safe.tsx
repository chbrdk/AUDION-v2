"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import type { Shadows, Theme } from "@mui/material/styles";
import { BRAND_FONT_FAMILY } from "../lib/branding";

type ThemeMode = "light" | "dark";

interface ThemeContextType {
  themeMode: ThemeMode;
  toggleTheme: () => void;
}

const defaultThemeContext: ThemeContextType = {
  themeMode: "light",
  toggleTheme: () => {}
};

const ThemeContext = createContext<ThemeContextType>(defaultThemeContext);

export const useThemeMode = () => {
  try {
    const context = useContext(ThemeContext);
    return context;
  } catch (e) {
    // During prerendering, context might be null - return default
    return defaultThemeContext;
  }
};

const lightShadows: Shadows = [
  "none",
  "0px 4px 20px rgba(15, 23, 42, 0.08)",
  ...Array.from({ length: 23 }, () => "0px 10px 30px rgba(15, 23, 42, 0.06)")
] as Shadows;

const darkShadows: Shadows = [
  "none",
  "0px 4px 20px rgba(0, 0, 0, 0.3)",
  ...Array.from({ length: 23 }, () => "0px 10px 30px rgba(0, 0, 0, 0.2)")
] as Shadows;

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0f172a" },
    secondary: { main: "#6366f1" },
    background: { default: "#ffffff", paper: "#f8fafc" }
  },
  typography: {
    fontFamily: BRAND_FONT_FAMILY,
    fontSize: 14
  },
  shape: {
    borderRadius: 12
  },
  shadows: lightShadows
});

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#ffffff" },
    secondary: { main: "#818cf8" },
    background: { default: "#0f172a", paper: "#1e293b" }
  },
  typography: {
    fontFamily: BRAND_FONT_FAMILY,
    fontSize: 14
  },
  shape: {
    borderRadius: 12
  },
  shadows: darkShadows
});

export const ThemeRegistrySSRSafe = ({ children }: { children: ReactNode }) => {
  // #region agent log
  // Hooks must be called unconditionally (Rules of Hooks)
  // But we check for browser context and return early to avoid useContext errors
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);
  const isBrowser = typeof window !== 'undefined';
  
  // During SSR/prerendering, return children without MUI ThemeProvider
  // This prevents MUI components from trying to access a non-existent ThemeContext
  // We still provide a basic ThemeContext for components that need it
  if (!isBrowser) {
    return (
      <ThemeContext.Provider value={{ themeMode: "light", toggleTheme: () => {} }}>
        {children}
      </ThemeContext.Provider>
    );
  }
  // #endregion

  useEffect(() => {
    const savedTheme = localStorage.getItem("audion-theme-mode") as ThemeMode | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setThemeMode(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-theme", themeMode);
      localStorage.setItem("audion-theme-mode", themeMode);
    }
  }, [themeMode, mounted]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const currentTheme: Theme = themeMode === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme }}>
      <AppRouterCacheProvider options={{ enableCssLayer: false }}>
        <ThemeProvider theme={currentTheme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </AppRouterCacheProvider>
    </ThemeContext.Provider>
  );
};
