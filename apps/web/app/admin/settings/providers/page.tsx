import { getPersonaBackendBase } from "../../../api/_lib/backend";
import { buildAuthHeaders, getServerAuthToken } from "../../../api/_lib/auth";

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
  const headers = buildAuthHeaders(getServerAuthToken());
  const response = await fetch(`${getPersonaBackendBase({ preferPublic: false })}/settings/ai/providers`, {
    cache: "no-store",
    headers,
  });
  if (!response.ok) {
    throw new Error("Failed to load provider information");
  }
  return response.json();
};

const statusLabel = (configured: boolean) => (configured ? "Connected" : "Missing key");

export default async function SettingsProvidersPage() {
  const data = await fetchProviders();

  return (
    <div className="msqdx-glass-panel">
      <header className="msqdx-glass-detail__header">
        <div>
          <p className="msqdx-glass-eyebrow">AI Settings</p>
          <h1 style={{ margin: 0 }}>Providers</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            Track which model backends are available to the workspace. Keys are never exposed, only their status.
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
                  Default model: {provider.model || "—"}
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
                Default
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
