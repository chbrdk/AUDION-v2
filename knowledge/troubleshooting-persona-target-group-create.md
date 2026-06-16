# Personas & Zielgruppen anlegen schlägt fehl

## Schnellcheck (Deployment)

Öffne im Browser (ohne Login):

`https://<deine-audion-domain>/api/health`

Wichtige Felder:

| Feld | Bedeutung |
|------|-----------|
| `status` | `ok` = Web erreichbar; `degraded` = Web läuft, Backend nicht |
| `personaBackend.personaBackendReachable` | `false` → API-Container nicht vom Web-Container erreichbar |
| `personaBackend.personaBackendAiConfigured` | `false` → KI-Generierung schlägt fehl (manuell anlegen kann trotzdem gehen) |
| `auth.personaBackendInternalUrlSet` | `false` → `NEXT_PERSONA_BACKEND_INTERNAL_URL` fehlt |

## Häufige Ursachen

### 1. Backend nicht erreichbar (503)

**Symptom:** Liste leer, Anlegen bricht mit Hinweis auf `NEXT_PERSONA_BACKEND_INTERNAL_URL` ab.

**Fix (Coolify, AUDION Web-App):**

```
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://audion-api:8000
```

- Hostname = **interner Service-Name** des API-Containers, keine Docker-IP.
- Kein `/api`-Suffix.
- API-Container muss laufen (`GET http://audion-api:8000/health` → 200).

Siehe auch: `knowledge/troubleshooting-503-auth-me.md`

### 2. KI nicht konfiguriert (`openai_not_configured`)

**Symptom:** Nur **„Mit KI generieren“** schlägt fehl; manuelles Anlegen mit Name/Segment funktioniert.

**Fix (Coolify, AUDION API-Container):**

Mindestens einer von:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

Container neu starten. Prüfen: API `/health` liefert `ai_provider_configured: true`.

### 3. Kein Projekt gewählt

**Symptom:** Fehler „Projekt“ / leeres Formular.

**Fix:** Im Header ein **aktives Projekt** auswählen, dann erneut anlegen.

### 4. Fehler erwähnt „MCP“ (PLEXON / Board-Assistent)

Das betrifft **nicht** die native AUDION-UI, sondern PLEXON oder Board-Chat.

**Zwei getrennte Konfigurationen:**

| Was | Variable | Wo | Richtiger Wert |
|-----|----------|-----|----------------|
| PLEXON → MCP-Server | `AUDION_MCP_URL` | PLEXON | `https://mcp-audion.<domain>` **oder** intern `http://audion-mcp:3100` |
| MCP-Server → FastAPI | `AUDION_API_URL` | **AUDION-MCP-Container** | `http://audion-api:8000` (ohne `/api`) |
| MCP-Server → Auth | `AUDION_API_TOKEN` | **AUDION-MCP-Container** | `audion_...` (API-Token aus AUDION) |

**Wichtig:** `https://mcp-audion.<domain>` ist nur der **MCP-Einstieg** (Health + `tools/list`). Wenn Personas/Zielgruppen trotzdem scheitern, ist fast immer **`AUDION_API_URL` auf dem MCP-Container falsch** — z. B. zeigt auf die **Web-URL** (`https://audion.<domain>`) statt auf die **FastAPI-API**. Symptom: MCP-Tools liefern `HTTP 404` mit Next.js-HTML.

**Schnelltest MCP-URL (öffentlich):**

```bash
# Health (GET)
curl -sS https://mcp-audion.<domain>
# → {"status":"ok","service":"audion-mcp"}

# Tools (POST)
curl -sS -X POST https://mcp-audion.<domain> \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

**Schnelltest API-Anbindung des MCP-Servers:**

```bash
curl -sS -X POST https://mcp-audion.<domain> \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"audion.health","arguments":{}}}'
```

- `{"status":"ok",...}` → `AUDION_API_URL` + Token OK  
- `HTTP 404` + HTML → `AUDION_API_URL` zeigt auf Web statt API  
- `AUDION_API_URL or AUDION_API_TOKEN not configured` → Env auf MCP-Container fehlt

PLEXON Admin: `GET /api/services/audion/status` (nur eingeloggt).

### 5. HTTP 500 bei `target_group_create` (PLEXON / MCP)

**Symptom:** Assistant meldet „AUDION API – HTTP 500“ beim Anlegen von Zielgruppen.

**Häufigste Ursache (live geprüft):** `AUDION_API_URL` auf dem **MCP-Container** zeigt auf die **Web-App**, nicht auf FastAPI.

**Schnelltest:**

```bash
curl -sS -X POST https://mcp-audion.<domain> \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"audion.health","arguments":{}}}'
```

| Antwort | Bedeutung |
|---------|-----------|
| `"service":"web"` / `"runtime":"nextjs"` | **Falsch** – MCP ruft Next.js auf |
| `"ai_provider_configured": true/false` | **Richtig** – FastAPI erreichbar |

**Fix (Coolify → audion-mcp):**

```
AUDION_API_URL=http://audion-api:8000
AUDION_API_TOKEN=audion_...
```

- Hostname = interner API-Service (wie in docker-compose), **ohne** `/api`.
- **Nicht** `https://audion.<domain>` (das ist die Web-UI).

Nach Env-Änderung MCP-Container **neu deployen**. Danach sollte `audion.health` `ai_provider_configured` zeigen und `audion.target_group_create` funktionieren.

**Weitere 500-Ursachen (seltener):**

| Ursache | Status | Fix |
|---------|--------|-----|
| `project_id` = Plattform-ID statt AUDION-UUID | 400 `project_not_found` | `audionProjectId` aus Projektkontext / `audion.projects_list` |
| Token-User kein Projekt-Mitglied | 403 | API-Token-Besitzer in AUDION dem Projekt zuweisen |
| DB-Migration fehlt (`status`-Spalte) | 500 + API-Log | API-Container neu starten (`init_db`) oder Alembic |

**`project_id` für MCP-Tools:** immer die **AUDION-Projekt-UUID** (`audionProjectId` im PLEXON-Board), nicht `platformProjectId` oder CHECKION-ID.


1. DevTools → Network
2. Aktion wiederholen (Zielgruppe/Persona anlegen)
3. Fehlgeschlagene Anfrage: `POST /api/target-groups` oder `POST /api/persona-admin`
4. **Status** und **Response body** notieren

## Code-Referenzen

- Fehlermeldungen UI: `apps/web/lib/api-error-humanize.ts`
- Health-Probe: `apps/web/lib/persona-backend-health.ts`
- API Health: `apps/api/app/main.py` → `/health`
