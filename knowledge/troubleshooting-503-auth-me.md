# 503 auf Auth/API (Service Unavailable)

Wenn die Web-App unter z. B. `https://audion.projects-a.plygrnd.tech` läuft und im Browser **503 (Service Unavailable)** erscheint für z. B.:

- **GET /api/auth/me** (Profil laden)
- **POST /api/auth/login** (Login)
- **POST /api/auth/register** (Registrierung)
- oder andere API-Routen, die an das Persona-Backend weiterleiten,

dann kann die Next.js-Web-App das **Persona-Backend (API)** nicht erreichen. **Ursache und Fix sind immer dieselben** (siehe unten).

## ECONNREFUSED zu einer `172.x.x.x`-Adresse (z. B. `:8000`)

Wenn Logs der Web-App **`connect ECONNREFUSED 172.18.0.xx:8000`** zeigen (z. B. bei **`/api/projects/...`**):

- **`NEXT_PERSONA_BACKEND_INTERNAL_URL`** ist sehr wahrscheinlich auf eine **feste Container-IP** gesetzt. Docker-VIPs ändern sich; nach Redeploy ist nichts mehr unter dieser IP erreichbar → **ECONNREFUSED**.
- **Fix:** URL auf den **stabilen internen Hostnamen** der API-App setzen (Coolify „internal“ hostname / Compose-**Service-Name**), z. B. `http://audion-api:8000` oder wie in eurer `docker-compose.yml` benannt — **nicht** `http://172.18.0.10:8000`.

## Ursache

Die Route `apps/web/app/api/auth/me/route.ts` leitet server-seitig an das Persona-Backend weiter. Dafür verwendet sie `getPersonaBackendBase({ preferPublic: false })`:

1. **NEXT_PERSONA_BACKEND_INTERNAL_URL** (bevorzugt, nur Server)
2. **NEXT_PUBLIC_PERSONA_BACKEND_URL** (Fallback)
3. **Fallback:** `http://api:8000`

Wenn der Fetch fehlschlägt (Connection refused, Timeout, falscher Host), antwortet die Route mit **503** und z. B. `"Persona backend unreachable"`.

## Checkliste (Coolify / Deployment)

### 1. Persona-Backend läuft

- In Coolify: Application für das **API**-Service (Persona Backend) prüfen – Status **Running**, Health Check grün.
- Direkt testen (von der Maschine aus, wo auch die Web-App läuft):  
  `curl -s -o /dev/null -w "%{http_code}" http://<INTERNER-HOST>:8000/health`  
  Erwartung: **200**.

### 2. Interne URL in der Web-App setzen

Die **Web-App** (Next.js) muss das Backend **intern** erreichen können. Dafür in den **Environment Variables der Web-App** setzen:

| Umgebungsvariable | Beispiel (Coolify) | Hinweis |
|------------------|--------------------|---------|
| **NEXT_PERSONA_BACKEND_INTERNAL_URL** | `http://audion-api:8000` oder `http://coolify-internal-persona-api:8000` | Hostname = interner Service-Name des API-Containers. |

- **Eine App (Docker Compose):** Wenn Web und API in derselben Compose liegen, ist der Service-Name z. B. `api` oder `audion-api` (laut `docker-compose.yml`).  
  → z. B. `NEXT_PERSONA_BACKEND_INTERNAL_URL=http://audion-api:8000`
- **Mehrere Coolify-Applications:** Web und API sind getrennt. Dann den **Coolify-internen Hostnamen** für die API verwenden (z. B. in der API-Application unter „Internal URL“ oder Netzwerk-Details). Oder die **öffentliche URL** der API für Server-Requests nutzen (siehe unten).

### 3. Öffentliche URL als Fallback (wenn kein gemeinsames Netzwerk)

Wenn Web- und API-Container **nicht** im gleichen Docker-Netzwerk sind (z. B. getrennte Coolify-Applications ohne gemeinsames Netz):

- **NEXT_PUBLIC_PERSONA_BACKEND_URL** auf die **öffentliche** API-URL setzen, z. B.  
  `https://audion-api.projects-a.plygrnd.tech` (oder mit Pfad, falls ihr einen API-Prefix habt).
- **NEXT_PERSONA_BACKEND_INTERNAL_URL** auf **dieselbe** öffentliche URL setzen, damit auch Server-Requests (z. B. `/api/auth/me`) diese URL nutzen:  
  `NEXT_PERSONA_BACKEND_INTERNAL_URL=https://audion-api.projects-a.plygrnd.tech`

Dann geht der Traffic über das öffentliche Netz; Voraussetzung ist, dass die API unter dieser URL erreichbar ist (Reverse Proxy / Coolify Domain korrekt).

### 4. Keine doppelten Slashes, kein Slash am Ende

- Richtig: `http://audion-api:8000` oder `https://audion-api.example.com`
- Vermeiden: `http://audion-api:8000/` (trailing slash kann je nach Client Probleme machen)

### 5. Nach Änderungen: Web-App neu deployen

Env-Variablen werden beim Build/Start gelesen. Nach Anpassung von `NEXT_PERSONA_BACKEND_*` die **Web-App** in Coolify neu deployen (Redeploy).

## Kurzfassung

- **503 auf /api/auth/me** = Next.js erreicht das Persona-Backend nicht.
- **NEXT_PERSONA_BACKEND_INTERNAL_URL** (und ggf. **NEXT_PUBLIC_PERSONA_BACKEND_URL**) in der **Web-App** so setzen, dass der Host von der Web-App aus erreichbar ist (interner Service-Name oder öffentliche API-URL).
- API-Container und Netzwerk (Coolify: gleiches Netz / interne Hostnamen) prüfen, dann Web-App redeployen.

Nach einem fehlgeschlagenen Login zeigt die Login-Seite eine **klarere Meldung** (statt nur englisch „Authentication service unavailable“), sobald die Web-App mit diesem Repo deployed ist.
