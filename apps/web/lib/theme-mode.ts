export const THEME_MODE_STORAGE_KEY = "audion-theme-mode";

export type ThemeMode = "light" | "dark" | "monochrome-dark" | "monochrome-light";

export const THEME_MODES: readonly ThemeMode[] = [
  "light",
  "dark",
  "monochrome-dark",
  "monochrome-light",
];

export const MONOCHROME_THEME_MODES = ["monochrome-dark", "monochrome-light"] as const;

export type MonochromeThemeMode = (typeof MONOCHROME_THEME_MODES)[number];

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return (
    value === "light" ||
    value === "dark" ||
    value === "monochrome-dark" ||
    value === "monochrome-light"
  );
}

/** Maps legacy `monochrome` storage value to the dark variant. */
export function normalizeThemeMode(value: string | null | undefined): ThemeMode | null {
  if (value === "monochrome") return "monochrome-dark";
  return isThemeMode(value) ? value : null;
}

export function isMonochromeMode(mode: ThemeMode): mode is MonochromeThemeMode {
  return mode === "monochrome-dark" || mode === "monochrome-light";
}

export function readThemeModeFromStorage(): ThemeMode | null {
  if (typeof localStorage === "undefined") return null;
  const saved = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  return normalizeThemeMode(saved);
}

/** MsqdxAdminNav (published DS) only accepts light | dark. */
export type AdminNavThemeMode = "light" | "dark";

export function toAdminNavThemeMode(mode: ThemeMode): AdminNavThemeMode {
  if (mode === "monochrome-light") return "dark";
  if (mode === "monochrome-dark") return "light";
  return mode;
}
