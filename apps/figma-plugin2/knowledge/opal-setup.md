# Opal anlegen – Übersicht für AUDION Figma Plugin

Alles, was du brauchst, um Opal so anzulegen, dass das AUDION Figma Plugin Discovery und Tools nutzen kann.

---

## 1. Wo findest du die Specs im Projekt?

| Thema | Ort im Repo |
|--------|----------------|
| **Discovery-Format** (JSON-Schema, Pflichtfelder) | `knowledge/urls-and-discovery.md` + `src/api/discovery-client.ts` (Interfaces `DiscoveryResponse`, `DiscoveredTool`) |
| **Zentrale URLs** (Default Discovery-URL, wenn gesetzt) | `src/config/urls.ts` → `URL_CONFIG.OPAL_DISCOVERY_URL` |
| **Auth** (Header, Token) | Überall: **Bearer Token** → Header `Authorization: Bearer <token>` |
| **Nutzung im Plugin** (Message-Types, Ablauf) | `knowledge/urls-and-discovery.md` (Abschnitt "Using discovery from the plugin") |
| **Tests** (Beispiel-Discovery-Response) | `src/api/discovery-client.test.ts` → `mockDiscoveryResponse` |

---

## 2. Was Opal bereitstellen muss

### Discovery-Endpoint

- **URL:** z.B. `https://<dein-opal>/\.well-known/discovery` (frei wählbar, wird im Plugin unter „Discovery URL (Opal)“ eingetragen).
- **Methode:** `GET`
- **Auth:** Optional `Authorization: Bearer <token>` (wenn du Discovery geschützt haben willst).
- **Response:** JSON mit folgendem Aufbau (TypeScript-Interfaces siehe `src/api/discovery-client.ts`):

```json
{
  "base_url": "https://api.opal.example.com",
  "version": "1.0",
  "tools": [
    {
      "id": "chat",
      "name": "Chat",
      "url": "/v1/chat",
      "method": "POST",
      "description": "Optional"
    },
    {
      "id": "status",
      "name": "Status",
      "url": "https://api.opal.example.com/health",
      "method": "GET"
    }
  ]
}
```

**Pflicht pro Tool:**

- `id` (string) – eindeutig, wird für `callDiscoveredTool(..., toolId)` genutzt
- `url` (string) – absolut (z.B. `https://...`) oder relativ zu `base_url` (z.B. `/v1/chat`)
- `method` (string) – einer von: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`

**Optional:** `name`, `description`.  
**Pflicht im Root:** `tools` (Array). Optional: `base_url` (für relative `url`), `version`.

### Tool-Endpoints

- Jeder Eintrag in `tools` beschreibt einen erreichbaren Endpoint.
- Beim Aufruf sendet das Plugin:
  - **Header:** `Content-Type: application/json`, `Accept: application/json`, und bei gesetztem Token `Authorization: Bearer <token>`.
  - **Body:** Bei POST/PUT/PATCH das vom Plugin übergebene JSON (vom Aufrufer von `callDiscoveredTool` bzw. Message `call-discovered-tool`).

Opal muss diese Endpoints so implementieren, dass sie mit Bearer-Auth und dem erwarteten Request-/Response-Format (z.B. JSON) funktionieren.

---

## 3. Kurz-Checkliste für Opal

- [ ] Discovery-URL festlegen (z.B. `/.well-known/discovery`).
- [ ] `GET <discovery-url>` liefert JSON mit `tools: []`.
- [ ] Jedes Tool hat `id`, `url`, `method`; bei relativer `url` ist `base_url` gesetzt.
- [ ] Tool-Endpoints akzeptieren optional `Authorization: Bearer <token>`.
- [ ] Im Plugin unter **Setup** die **Discovery URL (Opal)** eintragen; Nutzer sind eingeloggt (damit `authToken` für Bearer gesetzt ist).

---

## 4. Referenzen im Code

- **Discovery-Client (Typen + Logik):** `apps/figma-plugin2/src/api/discovery-client.ts`
- **Zentrale Config:** `apps/figma-plugin2/src/config/urls.ts`
- **Doku Discovery + Bearer:** `apps/figma-plugin2/knowledge/urls-and-discovery.md`
- **Plugin-Settings (inkl. opalDiscoveryUrl):** `apps/figma-plugin2/src/types/index.ts` → `PluginSettings`

Wenn du willst, können wir als Nächstes ein konkretes Opal-API-Design (z.B. OpenAPI) oder ein Beispiel-Response für deine erste Tool-Liste daraus ableiten.
