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
  // #region agent log
  // Workaround for Next.js 16 prerendering bug: check if we're in a browser context
  // During prerendering, React context is null, so we return a default value
  try {
    const context = useContext(ThemeContext);
    return context;
  } catch (e) {
    // During prerendering, context might be null - return default
    return defaultThemeContext;
  }
  // #endregion
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

const LIGHT_DX_COLOR_VARS = [
  "--color-secondary-dx-yellow",
  "--color-secondary-dx-yellow-tint",
  "--color-secondary-dx-pink",
  "--color-secondary-dx-pink-tint",
  "--color-secondary-dx-pink-on-light",
  "--color-secondary-dx-orange",
  "--color-secondary-dx-orange-overlay-20",
  "--color-secondary-dx-orange-tint",
  "--color-secondary-dx-purple",
  "--color-secondary-dx-green",
  "--color-secondary-dx-green-tint",
  "--color-secondary-dx-grey-light",
  "--color-secondary-dx-grey-light-tint"
];

// Mapping für Tint-Versionen der Farben
const COLOR_TINT_MAP: Record<string, string> = {
  "--color-secondary-dx-purple": "--color-secondary-dx-purple-tint",
  "--color-secondary-dx-blue": "--color-secondary-dx-blue-tint",
  "--color-secondary-dx-pink": "--color-secondary-dx-pink-tint",
  "--color-secondary-dx-orange": "--color-secondary-dx-orange-tint",
  "--color-secondary-dx-green": "--color-secondary-dx-green-tint",
  "--color-secondary-dx-yellow": "--color-secondary-dx-yellow-tint",
  "--color-secondary-dx-grey-light": "--color-secondary-dx-grey-light-tint",
  "--audion-light-border-color": "--color-secondary-dx-purple-tint", // Fallback für default
};

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#000000", light: "#333333", dark: "#000000" },
    secondary: { main: "#000000" },
    background: { default: "transparent", paper: "#FFFFFF" },
    text: {
      primary: "#000000",
      secondary: "#000000",
      disabled: "rgba(0,0,0,0.38)"
    }
  },
  typography: {
    fontFamily: BRAND_FONT_FAMILY,
    allVariants: {
      color: "#000000",
      fontWeight: 300
    },
    h1: {
      fontSize: "2rem",
      fontWeight: 600,
      lineHeight: 1.2,
      "@media (max-width: 959px)": {
        fontSize: "1.75rem",
        fontWeight: 600,
        lineHeight: 1.25
      }
    },
    h2: {
      fontSize: "1.75rem",
      fontWeight: 600,
      lineHeight: 1.3,
      "@media (max-width: 959px)": {
        fontSize: "1.5rem",
        fontWeight: 600,
        lineHeight: 1.3
      }
    },
    h3: {
      fontSize: "1.5rem",
      fontWeight: 600,
      lineHeight: 1.35,
      "@media (max-width: 959px)": {
        fontSize: "1.25rem",
        fontWeight: 600,
        lineHeight: 1.35
      }
    },
    h4: {
      fontSize: "1.25rem",
      fontWeight: 600,
      lineHeight: 1.4,
      "@media (max-width: 959px)": {
        fontSize: "1.125rem",
        fontWeight: 600,
        lineHeight: 1.4
      }
    },
    h5: {
      fontSize: "1.125rem",
      fontWeight: 500,
      lineHeight: 1.4,
      "@media (max-width: 959px)": {
        fontSize: "1rem",
        fontWeight: 500,
        lineHeight: 1.4
      }
    },
    h6: {
      fontSize: "1rem",
      fontWeight: 500,
      lineHeight: 1.4,
      "@media (max-width: 959px)": {
        fontSize: "0.9375rem",
        fontWeight: 500,
        lineHeight: 1.4
      }
    },
    body1: { 
      fontSize: "1rem",
      lineHeight: 1.6,
      fontWeight: 400,
      "@media (max-width: 959px)": {
        fontSize: "0.9375rem",
        lineHeight: 1.6,
        fontWeight: 400
      }
    },
    body2: { 
      fontSize: "0.875rem",
      lineHeight: 1.5,
      fontWeight: 400,
      "@media (max-width: 959px)": {
        fontSize: "0.8125rem",
        lineHeight: 1.5,
        fontWeight: 400
      }
    },
    button: {
      fontSize: "0.875rem",
      fontWeight: 600,
      lineHeight: 1.5,
      textTransform: "none",
      "@media (max-width: 959px)": {
        fontSize: "0.8125rem",
        fontWeight: 600
      }
    },
    caption: {
      fontSize: "0.75rem",
      lineHeight: 1.4,
      fontWeight: 400,
      "@media (max-width: 959px)": {
        fontSize: "0.6875rem",
        lineHeight: 1.4
      }
    }
  },
  shape: {
    borderRadius: 12
  },
  shadows: lightShadows
});

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#FFFFFF", light: "#FFFFFF", dark: "#CCCCCC" },
    secondary: { main: "#FFFFFF" },
    background: { default: "#0f0f0f", paper: "#1a1a1a" },
    text: {
      primary: "#FFFFFF",
      secondary: "#CCCCCC",
      disabled: "rgba(255,255,255,0.38)"
    }
  },
  typography: {
    fontFamily: BRAND_FONT_FAMILY,
    allVariants: {
      color: "#FFFFFF",
      fontWeight: 300
    },
    h1: {
      fontSize: "2rem",
      fontWeight: 600,
      lineHeight: 1.2,
      "@media (max-width: 959px)": {
        fontSize: "1.75rem",
        fontWeight: 600,
        lineHeight: 1.25
      }
    },
    h2: {
      fontSize: "1.75rem",
      fontWeight: 600,
      lineHeight: 1.3,
      "@media (max-width: 959px)": {
        fontSize: "1.5rem",
        fontWeight: 600,
        lineHeight: 1.3
      }
    },
    h3: {
      fontSize: "1.5rem",
      fontWeight: 600,
      lineHeight: 1.35,
      "@media (max-width: 959px)": {
        fontSize: "1.25rem",
        fontWeight: 600,
        lineHeight: 1.35
      }
    },
    h4: {
      fontSize: "1.25rem",
      fontWeight: 600,
      lineHeight: 1.4,
      "@media (max-width: 959px)": {
        fontSize: "1.125rem",
        fontWeight: 600,
        lineHeight: 1.4
      }
    },
    h5: {
      fontSize: "1.125rem",
      fontWeight: 500,
      lineHeight: 1.4,
      "@media (max-width: 959px)": {
        fontSize: "1rem",
        fontWeight: 500,
        lineHeight: 1.4
      }
    },
    h6: {
      fontSize: "1rem",
      fontWeight: 500,
      lineHeight: 1.4,
      "@media (max-width: 959px)": {
        fontSize: "0.9375rem",
        fontWeight: 500,
        lineHeight: 1.4
      }
    },
    body1: { 
      fontSize: "1rem",
      lineHeight: 1.6,
      fontWeight: 400,
      "@media (max-width: 959px)": {
        fontSize: "0.9375rem",
        lineHeight: 1.6,
        fontWeight: 400
      }
    },
    body2: { 
      fontSize: "0.875rem",
      lineHeight: 1.5,
      fontWeight: 400,
      "@media (max-width: 959px)": {
        fontSize: "0.8125rem",
        lineHeight: 1.5,
        fontWeight: 400
      }
    },
    button: {
      fontSize: "0.875rem",
      fontWeight: 600,
      lineHeight: 1.5,
      textTransform: "none",
      "@media (max-width: 959px)": {
        fontSize: "0.8125rem",
        fontWeight: 600
      }
    },
    caption: {
      fontSize: "0.75rem",
      lineHeight: 1.4,
      fontWeight: 400,
      "@media (max-width: 959px)": {
        fontSize: "0.6875rem",
        lineHeight: 1.4
      }
    }
  },
  shape: {
    borderRadius: 12
  },
  shadows: darkShadows
});

export const ThemeRegistry = ({ children }: { children: ReactNode }) => {
  // #region agent log
  // Workaround for Next.js 16 prerendering bug: check if we're in a browser context
  // During prerendering, React context is null, so we return children without theme
  // This prevents useContext from being called during prerendering
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) {
    // During SSR/prerendering, return children without theme context
    return <>{children}</>;
  }
  // #endregion
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load theme from localStorage on mount
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
    // Update data-theme attribute and localStorage
    if (mounted) {
      document.documentElement.setAttribute("data-theme", themeMode);
      localStorage.setItem("audion-theme-mode", themeMode);
    }
  }, [themeMode, mounted]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") {
      return;
    }

    if (themeMode === "light") {
      // Load saved preference or use default (no random to avoid hydration mismatch)
      const savedColorVar = localStorage.getItem("audion-sidebar-color");
      const selectedVar = savedColorVar || "--color-secondary-dx-purple";
      
      const styles = getComputedStyle(document.documentElement);
      const resolvedColor =
        (selectedVar ? styles.getPropertyValue(selectedVar).trim() : "") || "#0f172a";

      document.documentElement.style.setProperty("--audion-light-border-color", resolvedColor);
      document.documentElement.style.setProperty("--audion-light-html-background-color", resolvedColor);
      
      // In light theme, always use black text for sidebar
      document.documentElement.style.setProperty("--audion-sidebar-text-color", "#000000");
      
      // Set theme accent color (used for borders, accents, etc.)
      document.documentElement.style.setProperty("--color-theme-accent", `var(${selectedVar})`);
      
      // Set theme accent tint
      const tintVar = COLOR_TINT_MAP[selectedVar] || "--color-secondary-dx-purple-tint";
      document.documentElement.style.setProperty("--color-theme-accent-tint", `var(${tintVar})`);
    } else {
      // Dark theme: use white/light background for sidebar
      document.documentElement.style.setProperty("--audion-light-border-color", "#ffffff");
      document.documentElement.style.setProperty("--audion-light-html-background-color", "#ffffff");
      document.documentElement.style.setProperty("--audion-sidebar-text-color", "#000000");
      document.documentElement.style.setProperty("--color-theme-accent", "var(--color-secondary-dx-purple)");
      document.documentElement.style.setProperty("--color-theme-accent-tint", "var(--color-secondary-dx-purple-tint)");
    }
  }, [themeMode, mounted]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const currentTheme: Theme = themeMode === "dark" ? darkTheme : lightTheme;

  // Always provide the context, even before mount, to prevent errors
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

