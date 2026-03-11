import Link from "next/link";
import { getServerT } from "../../../lib/i18n/server";

export default async function SettingsLandingPage() {
  const t = await getServerT();
  const cards = [
    {
      title: t("settings.cards.profile.title"),
      description: t("settings.cards.profile.description"),
      href: "/admin/profile",
    },
    {
      title: t("settings.cards.projects.title"),
      description: t("settings.cards.projects.description"),
      href: "/admin/settings/projects",
    },
    {
      title: t("settings.cards.theme.title"),
      description: t("settings.cards.theme.description"),
      href: "/admin/settings/theme",
    },
    {
      title: t("settings.cards.providers.title"),
      description: t("settings.cards.providers.description"),
      href: "/admin/settings/providers",
    },
    {
      title: t("settings.cards.prompts.title"),
      description: t("settings.cards.prompts.description"),
      href: "/admin/projects",
    },
    {
      title: t("settings.cards.apiDocs.title"),
      description: t("settings.cards.apiDocs.description"),
      href: "/admin/settings/api-docs",
    },
  ];

  return (
    <div className="msqdx-glass-panel">
      <header className="msqdx-glass-detail__header">
        <div>
          <p className="msqdx-glass-eyebrow">{t("settings.eyebrow")}</p>
          <h1 style={{ margin: 0 }}>{t("settings.title")}</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            {t("settings.subtitle")}
          </p>
        </div>
      </header>

      <div className="msqdx-glass-settings-grid">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="msqdx-glass-settings-card">
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <span className="msqdx-glass-settings-card__cta">{t("common.open")}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
