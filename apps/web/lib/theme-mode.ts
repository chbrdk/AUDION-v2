export const THEME_MODE_STORAGE_KEY = "audion-theme-mode";

export type ThemeMode = "light" | "dark" | "monochrome";

export const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "monochrome"];

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark" || value === "monochrome";
}

export function readThemeModeFromStorage(): ThemeMode | null {
  if (typeof localStorage === "undefined") return null;
  const saved = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  return isThemeMode(saved) ? saved : null;
}

/** MsqdxAdminNav (published DS) only accepts light | dark. */
export type AdminNavThemeMode = "light" | "dark";

export function toAdminNavThemeMode(mode: ThemeMode): AdminNavThemeMode {
  return mode === "monochrome" ? "dark" : mode;
}
