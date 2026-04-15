import Link from "next/link";
import { getServerT } from "../../../lib/i18n/server";
import { ADMIN_ROUTES } from "../../../lib/routes";

export default async function SettingsLandingPage() {
  const t = await getServerT();

  const accountCards = [
    {
      title: t("settings.cards.profile.title"),
      description: t("settings.cards.profile.description"),
      href: "/admin/profile",
    },
    {
      title: t("settings.cards.theme.title"),
      description: t("settings.cards.theme.description"),
      href: "/admin/settings/theme",
    },
  ];

  const workspaceCards = [
    {
      title: t("settings.cards.projects.title"),
      description: t("settings.cards.projects.description"),
      href: "/admin/settings/projects",
    },
  ];

  const aiCards = [
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

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="msqdx-glass-eyebrow" style={{ marginBottom: "0.75rem" }}>
          {t("settings.groups.account")}
        </h2>
        <div className="msqdx-glass-settings-grid">
          {accountCards.map((card) => (
            <Link key={card.href} href={card.href} className="msqdx-glass-settings-card">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span className="msqdx-glass-settings-card__cta">{t("common.open")}</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="msqdx-glass-eyebrow" style={{ marginBottom: "0.75rem" }}>
          {t("settings.groups.workspace")}
        </h2>
        <div className="msqdx-glass-settings-grid">
          {workspaceCards.map((card) => (
            <Link key={card.href} href={card.href} className="msqdx-glass-settings-card">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span className="msqdx-glass-settings-card__cta">{t("common.open")}</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="msqdx-glass-eyebrow" style={{ marginBottom: "0.75rem" }}>
          {t("settings.groups.ai")}
        </h2>
        <div className="msqdx-glass-settings-grid">
          {aiCards.map((card) => (
            <Link key={card.href} href={card.href} className="msqdx-glass-settings-card">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span className="msqdx-glass-settings-card__cta">{t("common.open")}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="msqdx-glass-eyebrow" style={{ marginBottom: "0.75rem" }}>
          {t("settings.groups.developers")}
        </h2>
        <p className="msqdx-glass-muted" style={{ maxWidth: "640px", marginBottom: "0.5rem" }}>
          {t("settings.cards.apiDocs.description")}
        </p>
        <Link href={ADMIN_ROUTES.settingsApiDocs} className="msqdx-glass-settings-card" style={{ display: "inline-block", maxWidth: "420px" }}>
          <h3>{t("common.apiDocumentation")}</h3>
          <span className="msqdx-glass-settings-card__cta">{t("settings.apiDocsLink")}</span>
        </Link>
      </section>
    </div>
  );
}
