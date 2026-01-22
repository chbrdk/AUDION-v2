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
  
  // During SSR/prerendering, we cannot use MUI ThemeProvider because it uses useContext
  // But MUI components require a ThemeContext, so we provide a minimal one
  // The issue is that MUI components try to access ThemeContext during prerendering
  // even when we skip ThemeProvider, causing the useContext error
  // Solution: Provide a minimal MUI theme setup without using ThemeProvider
  if (!isBrowser) {
    // During SSR, we need to provide a theme context that MUI can use
    // But we can't use MUI ThemeProvider because it uses useContext
    // So we provide our custom ThemeContext and let MUI components use defaults
    return (
      <ThemeContext.Provider value={{ themeMode: "light", toggleTheme: () => {} }}>
        {/* Render children without MUI ThemeProvider during SSR */}
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

  // #region agent log
  // Provide MUI ThemeProvider only in browser
  // During SSR, we already returned early, so this code only runs in browser
  // AppRouterCacheProvider might use useContext, so we skip it during SSR
  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme }}>
      {isBrowser ? (
        <AppRouterCacheProvider options={{ enableCssLayer: false }}>
          <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      ) : (
        <ThemeProvider theme={currentTheme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      )}
    </ThemeContext.Provider>
  );
  // #endregion
};
