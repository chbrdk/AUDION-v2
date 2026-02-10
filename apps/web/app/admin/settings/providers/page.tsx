import { getPersonaBackendBase } from "../../../api/_lib/backend";
import { buildAuthHeaders, getServerAuthToken } from "../../../api/_lib/auth";
import { getServerT } from "../../../../lib/i18n/server";

type ProviderInfo = {
  id: string;
  label: string;
  model: string;
  api_key_configured: boolean;
};

type ProvidersResponse = {
  default_provider: string;
  providers: ProviderInfo[];
};

const fetchProviders = async (): Promise<ProvidersResponse> => {
  const headers = buildAuthHeaders(await getServerAuthToken());
  const response = await fetch(`${getPersonaBackendBase({ preferPublic: false })}/settings/ai/providers`, {
    cache: "no-store",
    headers,
  });
  if (!response.ok) {
    throw new Error("Failed to load provider information");
  }
  return response.json();
};

export default async function SettingsProvidersPage() {
  const t = await getServerT();
  const data = await fetchProviders();
  const statusLabel = (configured: boolean) =>
    configured ? t("settingsProviders.status.connected") : t("settingsProviders.status.missing");

  return (
    <div className="msqdx-glass-panel">
      <header className="msqdx-glass-detail__header">
        <div>
          <p className="msqdx-glass-eyebrow">{t("settingsProviders.eyebrow")}</p>
          <h1 style={{ margin: 0 }}>{t("settingsProviders.title")}</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            {t("settingsProviders.subtitle")}
          </p>
        </div>
      </header>

      <div className="msqdx-glass-settings-grid">
        {data.providers.map((provider) => (
          <div key={provider.id} className="msqdx-glass-settings-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ marginBottom: "0.25rem" }}>{provider.label}</h3>
                <p className="msqdx-glass-muted" style={{ margin: 0 }}>
                  {t("settingsProviders.defaultModel", { model: provider.model || "—" })}
                </p>
              </div>
              <span
                className={`msqdx-glass-status-pill ${provider.api_key_configured ? "--success" : "--warning"}`}
              >
                {statusLabel(provider.api_key_configured)}
              </span>
            </div>
            {data.default_provider === provider.id && (
              <p className="msqdx-glass-badge --outline" style={{ marginTop: "0.75rem", display: "inline-flex" }}>
                {t("settingsProviders.default")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
