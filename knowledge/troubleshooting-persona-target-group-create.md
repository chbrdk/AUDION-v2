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

**Fix (PLEXON + AUDION-MCP):**

| Variable | Wo | Wert |
|----------|-----|------|
| `AUDION_MCP_URL` | PLEXON | `http://audion-mcp:3100` (intern) |
| `AUDION_API_URL` | PLEXON, AUDION-MCP | `http://audion-api:8000` (ohne `/api`) |
| `AUDION_API_TOKEN` | PLEXON, AUDION-MCP | `audion_...` (API-Token aus AUDION) |

PLEXON Admin: `GET /api/services/audion/status` (nur eingeloggt).

## Browser-Netzwerk prüfen

1. DevTools → Network
2. Aktion wiederholen (Zielgruppe/Persona anlegen)
3. Fehlgeschlagene Anfrage: `POST /api/target-groups` oder `POST /api/persona-admin`
4. **Status** und **Response body** notieren

## Code-Referenzen

- Fehlermeldungen UI: `apps/web/lib/api-error-humanize.ts`
- Health-Probe: `apps/web/lib/persona-backend-health.ts`
- API Health: `apps/api/app/main.py` → `/health`
