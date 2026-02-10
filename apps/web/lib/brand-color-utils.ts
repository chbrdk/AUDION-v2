/**
 * Shared utilities for brand color selection.
 * Used by BrandColorSelector, login/register pages, and admin layout.
 */

export const BRAND_COLOR_STORAGE_KEY = "audion-sidebar-color";
export const BRAND_COLOR_DEFAULT = "--color-secondary-dx-green";

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

export function applyBrandColorVars(
  varName: string,
  themeMode: "light" | "dark"
): void {
  if (typeof document === "undefined") return;

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

    const textColor =
      themeMode === "light"
        ? "#000000"
        : OPTIONS_META.find((o) => o.varName === varName)?.textColor || "#ffffff";
    document.documentElement.style.setProperty(
      "--audion-sidebar-text-color",
      textColor
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

    const textOnAccent =
      varName === "--color-secondary-dx-yellow" ? "#000000" : "#ffffff";
    document.documentElement.style.setProperty("--auth-logo-color", textOnAccent);
    document.documentElement.style.setProperty(
      "--auth-button-text-color",
      textOnAccent
    );
  }
}

/** Initializes brand color from localStorage. Call on admin layout mount. */
export function initBrandColorFromStorage(
  themeMode: "light" | "dark"
): void {
  const saved =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(BRAND_COLOR_STORAGE_KEY)
      : null;
  const colorVar = saved || BRAND_COLOR_DEFAULT;
  applyBrandColorVars(colorVar, themeMode);
}
