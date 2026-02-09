import Link from "next/link";

const cards = [
  {
    title: "Projects & Access",
    description: "Create projects, switch ownership context, and manage shared access.",
    href: "/admin/settings/projects",
  },
  {
    title: "Theme",
    description: "Customize sidebar colors and appearance preferences.",
    href: "/admin/settings/theme",
  },
  {
    title: "AI Providers",
    description: "Configure Anthropic and OpenAI defaults, verify keys, and review usage policies.",
    href: "/admin/settings/providers",
  },
  {
    title: "Prompt Templates",
    description: "Review and manage the central prompt catalog used across journeys, personas, and target groups.",
    href: "/admin/settings/prompts",
  },
  {
    title: "API Documentation",
    description: "Interactive API reference for the Persona Backend. Explore endpoints, test requests, and view schemas.",
    href: "/admin/settings/api-docs",
  },
];

export default function SettingsLandingPage() {
  return (
    <div className="msqdx-glass-panel">
      <header className="msqdx-glass-detail__header">
        <div>
          <p className="msqdx-glass-eyebrow">Control Center</p>
          <h1 style={{ margin: 0 }}>Settings</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            Centralize AI assistance configuration. Review provider health, prompt templates, and rollout status for new capabilities.
          </p>
        </div>
      </header>

      <div className="msqdx-glass-settings-grid">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="msqdx-glass-settings-card">
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <span className="msqdx-glass-settings-card__cta">Open</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

