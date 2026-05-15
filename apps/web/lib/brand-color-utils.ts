/**
 * Shared utilities for brand color selection.
 * Used by BrandColorSelector, login/register pages, and admin layout.
 */

import type { ThemeMode } from "./theme-mode";
import { isMonochromeMode } from "./theme-mode";

export const BRAND_COLOR_STORAGE_KEY = "audion-sidebar-color";
export const BRAND_COLOR_DEFAULT = "--color-secondary-dx-green";

/** Farben, auf denen Text/Icons schwarz statt weiß sein müssen (helle Hintergründe) */
export const LIGHT_ACCENT_COLORS = [
  "--color-secondary-dx-yellow",
  "--color-secondary-dx-grey-light",
  "--color-secondary-dx-green",
] as const;

export function isLightAccentColor(varName: string): boolean {
  return (LIGHT_ACCENT_COLORS as readonly string[]).includes(varName);
}

const OPTIONS_META: {
  varName: string;
  preview: string;
  textColor: string;
}[] = [
  { varName: "--color-secondary-dx-purple", preview: "#b638ff", textColor: "#ffffff" },
  { varName: "--color-secondary-dx-blue", preview: "#3b82f6", textColor: "#ffffff" },
  { varName: "--color-secondary-dx-pink", preview: "#f256b6", textColor: "#ffffff" },
  { varName: "--color-secondary-dx-orange", preview: "#ff6a3b", textColor: "#ffffff" },
  { varName: "--color-secondary-dx-green", preview: "#00ca55", textColor: "#000000" },
  { varName: "--color-secondary-dx-yellow", preview: "#fef14d", textColor: "#000000" },
  { varName: "--color-secondary-dx-grey-light", preview: "#d4d2d2", textColor: "#000000" },
  { varName: "--audion-light-border-color", preview: "#0f172a", textColor: "#ffffff" },
];

const COLOR_TINT_MAP: Record<string, string> = {
  "--color-secondary-dx-purple": "--color-secondary-dx-purple-tint",
  "--color-secondary-dx-blue": "--color-secondary-dx-blue-tint",
  "--color-secondary-dx-pink": "--color-secondary-dx-pink-tint",
  "--color-secondary-dx-orange": "--color-secondary-dx-orange-tint",
  "--color-secondary-dx-green": "--color-secondary-dx-green-tint",
  "--color-secondary-dx-yellow": "--color-secondary-dx-yellow-tint",
  "--color-secondary-dx-grey-light": "--color-secondary-dx-grey-light-tint",
  "--audion-light-border-color": "--color-secondary-dx-purple-tint",
};

/** Original monochrome: white canvas/sidebar, black app content, white borders. */
export function applyMonochromeDarkBrandVars(): void {
  if (typeof document === "undefined") return;

  document.documentElement.style.setProperty("--audion-light-border-color", "#ffffff");
  document.documentElement.style.setProperty("--audion-chrome-surface", "#ffffff");
  document.documentElement.style.setProperty("--audion-light-html-background-color", "#ffffff");
  document.documentElement.style.setProperty("--audion-sidebar-text-color", "#000000");
  document.documentElement.style.setProperty("--color-theme-accent-contrast", "#000000");
  document.documentElement.style.setProperty("--audion-sidebar-hover-bg", "rgba(0, 0, 0, 0.08)");
  document.documentElement.style.setProperty("--audion-sidebar-active-bg", "rgba(0, 0, 0, 0.14)");
  document.documentElement.style.setProperty("--color-theme-accent", "#ffffff");
  document.documentElement.style.setProperty("--color-theme-accent-tint", "rgba(255, 255, 255, 0.06)");
  document.documentElement.style.setProperty("--auth-logo-color", "#ffffff");
  document.documentElement.style.setProperty("--auth-button-text-color", "#000000");
  document.documentElement.style.setProperty("--color-input-label", "#ffffff");
}

/** Inverted monochrome: black canvas/sidebar, white content, black borders. */
export function applyMonochromeLightBrandVars(): void {
  if (typeof document === "undefined") return;

  document.documentElement.style.setProperty("--audion-light-border-color", "#000000");
  document.documentElement.style.setProperty("--audion-chrome-surface", "#000000");
  document.documentElement.style.setProperty("--audion-light-html-background-color", "#000000");
  document.documentElement.style.setProperty("--audion-sidebar-text-color", "#ffffff");
  document.documentElement.style.setProperty("--color-theme-accent-contrast", "#ffffff");
  document.documentElement.style.setProperty("--audion-sidebar-hover-bg", "rgba(255, 255, 255, 0.08)");
  document.documentElement.style.setProperty("--audion-sidebar-active-bg", "rgba(255, 255, 255, 0.14)");
  document.documentElement.style.setProperty("--color-theme-accent", "#000000");
  document.documentElement.style.setProperty("--color-theme-accent-tint", "rgba(0, 0, 0, 0.06)");
  document.documentElement.style.setProperty("--auth-logo-color", "#000000");
  document.documentElement.style.setProperty("--auth-button-text-color", "#ffffff");
  document.documentElement.style.setProperty("--color-input-label", "#000000");
}

export function applyMonochromeBrandVars(themeMode: "monochrome-dark" | "monochrome-light"): void {
  if (themeMode === "monochrome-dark") {
    applyMonochromeDarkBrandVars();
  } else {
    applyMonochromeLightBrandVars();
  }
}

export function applyBrandColorVars(varName: string, themeMode: ThemeMode): void {
  if (typeof document === "undefined") return;

  if (isMonochromeMode(themeMode)) {
    applyMonochromeBrandVars(themeMode);
    return;
  }

  const styles = getComputedStyle(document.documentElement);
  const resolvedColor =
    styles.getPropertyValue(varName).trim() ||
    (varName === "--audion-light-border-color" ? "#0f172a" : "");

  if (resolvedColor) {
    document.documentElement.style.setProperty(
      "--audion-light-border-color",
      resolvedColor
    );
    document.documentElement.style.setProperty(
      "--audion-light-html-background-color",
      resolvedColor
    );

    /* Text auf Sidebar/Accent: schwarz bei gelb, grau, grün; weiß bei dunklen Farben */
    const textOnAccentColor = OPTIONS_META.find((o) => o.varName === varName)?.textColor || "#ffffff";
    const isLight = textOnAccentColor === "#000000";
    document.documentElement.style.setProperty(
      "--audion-sidebar-text-color",
      textOnAccentColor
    );
    document.documentElement.style.setProperty(
      "--color-theme-accent-contrast",
      textOnAccentColor
    );
    /* Hover/Active auf Sidebar: dunkler Overlay bei hellem Hintergrund, heller bei dunklem */
    document.documentElement.style.setProperty(
      "--audion-sidebar-hover-bg",
      isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.1)"
    );
    document.documentElement.style.setProperty(
      "--audion-sidebar-active-bg",
      isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.15)"
    );

    document.documentElement.style.setProperty(
      "--color-theme-accent",
      `var(${varName})`
    );

    const tintVar =
      COLOR_TINT_MAP[varName] || "--color-secondary-dx-purple-tint";
    document.documentElement.style.setProperty(
      "--color-theme-accent-tint",
      `var(${tintVar})`
    );

    /* Auth (Login/Register): Logo und Button-Text auf Accent-Hintergrund */
    const textOnAccent = textOnAccentColor;
    document.documentElement.style.setProperty("--auth-logo-color", textOnAccent);
    document.documentElement.style.setProperty(
      "--auth-button-text-color",
      textOnAccent
    );

    /* Input Labels: schwarz bei gelb und hellgrau (bessere Lesbarkeit), sonst Theme-Akzent */
    const labelShouldBeBlack =
      varName === "--color-secondary-dx-yellow" ||
      varName === "--color-secondary-dx-grey-light";
    document.documentElement.style.setProperty(
      "--color-input-label",
      labelShouldBeBlack ? "#000000" : "var(--color-theme-accent)"
    );
  }
}

/** Initializes brand color from localStorage. Call on admin layout mount. */
export function initBrandColorFromStorage(themeMode: ThemeMode): void {
  if (isMonochromeMode(themeMode)) {
    applyMonochromeBrandVars(themeMode);
    return;
  }
  const saved =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(BRAND_COLOR_STORAGE_KEY)
      : null;
  const colorVar = saved || BRAND_COLOR_DEFAULT;
  applyBrandColorVars(colorVar, themeMode);
}
