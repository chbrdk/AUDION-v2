# URLs and Discovery (Opal)

## Central URL config

All API and discovery URLs are defined in **`src/config/urls.ts`**. Do not hardcode URLs elsewhere.

- **`URL_CONFIG.AUDION_API_BASE`** – Default AUDION API base (overridable in plugin settings).
- **`URL_CONFIG.AUDION_DISCOVERY_URL`** – AUDION’s own discovery URL (Opal-format). Use this to register AUDION in Opal; see `knowledge/audion-in-opal.md`.
- **`URL_CONFIG.OPAL_DISCOVERY_URL`** – Optional other Opal discovery (e.g. Opal hub); overridable in settings as `opalDiscoveryUrl`.
- **`URL_CONFIG.RAG_API_BASE`** – CREATION (RAG / compose / capture). Overridable in settings as `ragApiUrl`.
- **`HTML_FIGMA_CSS_REGRESSION_FIXTURE_PATH`** + **`getHtmlFigmaCssRegressionFixtureUrl(base)`** – CREATION serves the CSS regression HTML at `{base}/fixtures/html-figma-css-regression.html`. Used by **HTML TO FIGMA → CSS regression (test page)**; the CREATION host must match this base.

## Bearer token

AUDION uses **Bearer token** auth everywhere:

- Plugin settings store `authToken` (from login at `/api/auth/login`).
- `audion-client.ts` sends `Authorization: Bearer ${currentAuthToken}` on all requests.
- Discovery and tool calls use the same token when calling Opal or other discovered APIs.

## Discovery URL (Opal)

If you set **Discovery URL (Opal)** in plugin Settings, the plugin can:

1. **Fetch discovery** – `GET <discoveryUrl>` returns JSON with a `tools` array.
2. **List tools** – Use `listDiscoveredTools(discoveryUrl, bearerToken?)` (or message `list-discovered-tools` from UI).
3. **Call a tool** – Use `callDiscoveredTool(discoveryUrl, toolId, { bearerToken, body })` (or message `call-discovered-tool` from UI).

Discovery response shape:

```json
{
  "base_url": "https://api.example.com",
  "tools": [
    {
      "id": "my-tool",
      "name": "My Tool",
      "url": "/v1/tools/my-tool",
      "method": "POST",
      "description": "Optional"
    }
  ],
  "version": "1.0"
}
```

- `base_url` is used when `url` is relative.
- Each tool has `id`, `url`, `method`; optional `name`, `description`.

## Using discovery from the plugin

- **UI (iframe):** Import from `api/discovery-client.ts` and use `fetchDiscovery`, `listDiscoveredTools`, `callDiscoveredTool` with the global `fetch`.
- **Main thread (code.ts):** Use message handlers:
  - `list-discovered-tools` → response `discovered-tools` with `{ tools, error? }`.
  - `call-discovered-tool` with `{ toolId, body?, discoveryUrl? }` → response `discovered-tool-result` with `{ result, error? }`.
  - Discovery URL is taken from `msg.discoveryUrl` or from stored settings `opalDiscoveryUrl`. Bearer token comes from stored `authToken`.

## References

- `src/config/urls.ts` – central URL config
- `src/api/audion-client.ts` – AUDION API + Bearer auth
- `src/api/discovery-client.ts` – discovery fetch + tool calls
- `src/types/index.ts` – `PluginSettings.opalDiscoveryUrl`
