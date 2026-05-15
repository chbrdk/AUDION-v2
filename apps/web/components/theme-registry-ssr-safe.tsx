"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import type { Shadows, Theme } from "@mui/material/styles";
import { BRAND_FONT_FAMILY } from "../lib/branding";
import {
  THEME_MODE_STORAGE_KEY,
  type ThemeMode,
  readThemeModeFromStorage,
} from "../lib/theme-mode";
import { applyMonochromeBrandVars, initBrandColorFromStorage } from "../lib/brand-color-utils";

export type { ThemeMode };

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const defaultThemeContext: ThemeContextType = {
  themeMode: "light",
  setThemeMode: () => {},
  toggleTheme: () => {},
};

const ThemeContext = createContext<ThemeContextType>(defaultThemeContext);

export const useThemeMode = () => {
  try {
    const context = useContext(ThemeContext);
    return context;
  } catch {
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
    background: { default: "#ffffff", paper: "#f8fafc" },
  },
  typography: {
    fontFamily: BRAND_FONT_FAMILY,
    fontSize: 14,
  },
  shape: {
    borderRadius: 12,
  },
  shadows: lightShadows,
});

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#ffffff" },
    secondary: { main: "#818cf8" },
    background: { default: "#0f172a", paper: "#1e293b" },
  },
  typography: {
    fontFamily: BRAND_FONT_FAMILY,
    fontSize: 14,
  },
  shape: {
    borderRadius: 12,
  },
  shadows: darkShadows,
});

const monochromeTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#ffffff", contrastText: "#000000" },
    secondary: { main: "#ffffff" },
    background: { default: "#000000", paper: "#0a0a0a" },
    text: { primary: "#ffffff", secondary: "rgba(255, 255, 255, 0.72)" },
    divider: "#ffffff",
  },
  typography: {
    fontFamily: BRAND_FONT_FAMILY,
    fontSize: 14,
  },
  shape: {
    borderRadius: 12,
  },
  shadows: darkShadows,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          border: "1px solid #ffffff",
          boxShadow: "none",
        },
        outlined: {
          borderColor: "#ffffff",
          color: "#ffffff",
        },
        contained: {
          backgroundColor: "#ffffff",
          color: "#000000",
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.9)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(255, 255, 255, 0.55)",
          backgroundColor: "#0a0a0a",
          color: "#ffffff",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: "rgba(255, 255, 255, 0.55)",
        },
      },
    },
  },
});

function resolveMuiTheme(themeMode: ThemeMode): Theme {
  if (themeMode === "monochrome") return monochromeTheme;
  if (themeMode === "dark") return darkTheme;
  return lightTheme;
}

function applyThemeToDocument(themeMode: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", themeMode);
  if (themeMode === "monochrome") {
    applyMonochromeBrandVars();
  } else {
    initBrandColorFromStorage(themeMode);
  }
}

export const ThemeRegistrySSRSafe = ({ children }: { children: ReactNode }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);
  const isBrowser = typeof window !== "undefined";

  useEffect(() => {
    const savedTheme = readThemeModeFromStorage();
    const initial = savedTheme ?? "light";
    setThemeModeState(initial);
    document.documentElement.setAttribute("data-theme", initial);
    if (initial === "monochrome") {
      applyMonochromeBrandVars();
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyThemeToDocument(themeMode);
    localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
  }, [themeMode, mounted]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const toggleTheme = () => {
    setThemeModeState((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "monochrome";
      return "light";
    });
  };

  const currentTheme = resolveMuiTheme(themeMode);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, toggleTheme }}>
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
};
