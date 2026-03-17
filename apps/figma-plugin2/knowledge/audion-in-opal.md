# AUDION in Opal bereitstellen

AUDION **stellt sich selbst** im Opal-Format bereit: Die AUDION-API hat einen Discovery-Endpoint. So kannst du AUDION in Opal (oder jedem anderen Client, der dieses Format nutzt) verwenden.

---

## AUDION Discovery URL

| Umgebung | URL |
|----------|-----|
| **Default (Production)** | `https://audion.projects-a.plygrnd.tech/.well-known/discovery` |
| **Eigene Instanz** | `https://<deine-audion-base>/.well-known/discovery` |

Falls die API in eurer Umgebung unter `/api` gemountet ist, lautet die URL:  
`https://<base>/api/.well-known/discovery`.

- **Methode:** `GET`
- **Auth:** Optional `Authorization: Bearer <token>`
- **Response:** JSON mit `base_url`, `tools[]` (id, url, method, name, description)

---

## Was der Endpoint liefert

Der Discovery-Endpoint listet die AUDION-APIs als „Tools“ im Opal-Format:

- `auth-login` – POST `/api/auth/login` (Login, Token)
- `personas-list` – GET `/api/personas`
- `personas-get` – GET `/api/personas/{persona_id}`
- `target-groups-list` – GET `/api/target-groups`
- `projects-list` – GET `/api/projects`
- `journeys-list` – GET `/api/journeys`
- `journeys-get` – GET `/api/journeys/{journey_id}`
- `chat-message` – POST `/api/chat/message` (Bearer erforderlich)
- `chat-images-upload` – POST `/api/chat/images/upload` (Bearer erforderlich)

Alle Aufrufe (außer Login) nutzen **Bearer Token** oder **X-API-Key** (API-Token, kein Cookie).

---

## Login-Schranke umgehen: API-Token für Opal (kein Cookie)

Opal soll **ohne Cookie/Login** direkt mit der API sprechen. Dafür nutzt ihr einen **API-Token** (kein Session-JWT).

### API-Token verwenden

- **Format:** `audion_` + 64 Hex-Zeichen (z. B. `audion_a1b2c3...`).
- **Übergabe an die API** (beide Varianten möglich):
  - **`Authorization: Bearer <api_token>`**
  - **`X-API-Key: <api_token>`** (für Proxies, die nur API-Key-Header durchlassen)
- Es ist **kein Login**, **kein Cookie** und keine Session nötig – der API-Token reicht für alle geschützten Endpoints.

### API-Token erzeugen

1. Einmalig im Web (oder mit bestehendem JWT): **Login** → dann **POST /auth/tokens** mit Body `{ "name": "Opal" }`.
2. Response enthält `token` (nur einmal sichtbar) – diesen in Opal als Bearer bzw. X-API-Key hinterlegen.

### Wenn eine Login-Schranke (Proxy/Gateway) davor hängt

Damit Opal die API erreicht, ohne eine Cookie-Session zu haben:

- **Option A:** Gateway so konfigurieren, dass Requests mit **`Authorization: Bearer`** (oder **`X-API-Key`**) auf die API (z. B. Pfad `/api/*`, `/.well-known/*`) **nicht** zur Login-Seite umgeleitet werden, sondern an die AUDION-API durchgereicht werden.
- **Option B:** Opal direkt auf die **API-URL** (Backend) zeigen, wenn diese getrennt vom Web-Frontend (und der Cookie-Login-Schranke) erreichbar ist.

Die AUDION-API selbst prüft **nur** Bearer/API-Token (bzw. X-API-Key), **keine** Cookies.

---

## AUDION in Opal eintragen

1. In Opal die **Discovery-URL von AUDION** eintragen:  
   `https://<audion-base>/.well-known/discovery`
2. Opal kann dann `GET` auf diese URL ausführen und die `tools`-Liste verwenden.
3. Beim Aufruf der Tools: **Authorization: Bearer &lt;api_token&gt;** oder **X-API-Key: &lt;api_token&gt;** mitschicken (API-Token wie oben erzeugen).

---

## Im Figma-Plugin

- **AUDION API URL** = Basis der AUDION-API (z. B. `https://audion.projects-a.plygrnd.tech`).
- **Discovery URL (Opal)** kannst du auf die **AUDION-Discovery-URL** setzen, wenn du die Tools von AUDION über Discovery nutzen willst:  
  `https://<audion-base>/.well-known/discovery`  
  Default dafür ist in `src/config/urls.ts`: `URL_CONFIG.AUDION_DISCOVERY_URL`.

---

## Code-Referenzen

- **Discovery-Endpoint (Backend):** `apps/api/app/routers/discovery.py`
- **Registrierung:** `apps/api/app/main.py` → `discovery_router`
- **Auth (Bearer + X-API-Key für Opal):** `apps/api/app/services/auth.py` → `get_current_user`
- **API-Token anlegen:** `POST /auth/tokens` (mit JWT oder API-Token), siehe `apps/api/app/routers/auth_tokens.py`
- **Plugin-URL-Config:** `apps/figma-plugin2/src/config/urls.ts` → `AUDION_DISCOVERY_URL`
