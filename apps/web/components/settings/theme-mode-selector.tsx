"use client";

import { MsqdxButton } from "@msqdx/react";
import { useThemeMode } from "../theme-registry";
import { useI18n } from "../i18n/i18n-provider";
import type { ThemeMode } from "../../lib/theme-mode";

const MODES: ThemeMode[] = ["light", "dark", "monochrome-dark", "monochrome-light"];

type ThemeModeSelectorProps = {
  size?: "small" | "medium";
};

export function ThemeModeSelector({ size = "medium" }: ThemeModeSelectorProps) {
  const { t } = useI18n();
  const { themeMode, setThemeMode } = useThemeMode();

  const labels: Record<ThemeMode, string> = {
    light: t("settingsTheme.light"),
    dark: t("settingsTheme.dark"),
    "monochrome-dark": t("settingsTheme.monochromeDark"),
    "monochrome-light": t("settingsTheme.monochromeLight"),
  };

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      {MODES.map((mode) => (
        <MsqdxButton
          key={mode}
          variant={themeMode === mode ? "contained" : "outlined"}
          size={size}
          onClick={() => setThemeMode(mode)}
          aria-pressed={themeMode === mode}
        >
          {labels[mode]}
        </MsqdxButton>
      ))}
    </div>
  );
}
