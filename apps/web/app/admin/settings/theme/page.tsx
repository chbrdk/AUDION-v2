"use client";

export const dynamic = "force-dynamic";

import { BrandColorSelector } from "../../../../components/settings/brand-color-selector";
import { useI18n } from "../../../../components/i18n/i18n-provider";

export default function ThemeSettingsPage() {
  const { t } = useI18n();

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
