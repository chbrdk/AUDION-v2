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

Alle Aufrufe (außer Login) nutzen **Bearer Token** (nach Login).

---

## AUDION in Opal eintragen

1. In Opal die **Discovery-URL von AUDION** eintragen:  
   `https://<audion-base>/.well-known/discovery`
2. Opal kann dann `GET` auf diese URL ausführen und die `tools`-Liste verwenden.
3. Beim Aufruf der Tools: **Authorization: Bearer &lt;token&gt;** mitschicken (Token von AUDION-Login).

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
- **Plugin-URL-Config:** `apps/figma-plugin2/src/config/urls.ts` → `AUDION_DISCOVERY_URL`
