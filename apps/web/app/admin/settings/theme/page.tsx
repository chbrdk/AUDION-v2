"use client";

export const dynamic = "force-dynamic";

import { MsqdxButton } from "@msqdx/react";
import { BrandColorSelector } from "../../../../components/settings/brand-color-selector";
import { useThemeMode } from "../../../../components/theme-registry";
import { useI18n } from "../../../../components/i18n/i18n-provider";

export default function ThemeSettingsPage() {
  const { t } = useI18n();
  const { themeMode, toggleTheme } = useThemeMode();

  return (
    <div className="msqdx-glass-panel">
      <header className="msqdx-glass-detail__header">
        <div>
          <p className="msqdx-glass-eyebrow">{t("settingsTheme.eyebrow")}</p>
          <h1 style={{ margin: 0 }}>{t("settingsTheme.title")}</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            {t("settingsTheme.subtitle")}
          </p>
        </div>
      </header>

      <div style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
          {t("settingsTheme.modeTitle")}
        </h2>
        <p className="msqdx-glass-muted" style={{ marginBottom: "1.5rem" }}>
          {t("settingsTheme.modeSubtitle")}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <MsqdxButton
            variant={themeMode === "light" ? "contained" : "outlined"}
            size="medium"
            onClick={() => themeMode !== "light" && toggleTheme()}
            disabled={themeMode === "light"}
          >
            {t("settingsTheme.light")}
          </MsqdxButton>
          <MsqdxButton
            variant={themeMode === "dark" ? "contained" : "outlined"}
            size="medium"
            onClick={() => themeMode !== "dark" && toggleTheme()}
            disabled={themeMode === "dark"}
          >
            {t("settingsTheme.dark")}
          </MsqdxButton>
        </div>
      </div>

      <div style={{ marginTop: "2.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
          {t("settingsTheme.sidebarTitle")}
        </h2>
        <p className="msqdx-glass-muted" style={{ marginBottom: "1.5rem" }}>
          {t("settingsTheme.sidebarSubtitle")}
        </p>
        <BrandColorSelector />
      </div>
    </div>
  );
}
