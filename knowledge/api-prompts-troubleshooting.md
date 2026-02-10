# Prompts/Settings API – Fehlerbehebung

## Fehler 405 / 404 auf der Prompts-Seite

### Symptome

- `GET /api/ai-assist/templates` → **405 Method Not Allowed**
- `GET /api/settings/ai/persona-prompts` → **404 Not Found**

### Ursache

Die Requests werden vom Next.js-Server an das Persona-Backend (Python FastAPI) weitergeleitet. Die Fehler stammen in der Regel vom Backend oder von der Routing-Konfiguration.

### Änderung am Code (2025-02)

`listTemplates` nutzt nun den **Settings-Proxy** statt des ai-assist-Proxys:

- **Vorher:** `buildAiAssistUrl("/templates")` → `/api/ai-assist/templates`
- **Nachher:** `buildSettingsUrl("/ai/templates")` → `/api/settings/ai/templates`

Damit sind Templates-Liste, -Laden und -Speichern über dieselbe Proxy-Route (`/api/settings/*`) erreichbar.

### Checkliste für Deployment (405/404)

1. **Persona-Backend-Version prüfen**
   - Die Routen `/ai-assist/templates`, `/settings/ai/templates` und `/settings/ai/persona-prompts` müssen im Python-Backend existieren (`apps/api/app/routers/ai_assist.py`, `settings.py`).

2. **Umgebungsvariablen**
   - `NEXT_PERSONA_BACKEND_INTERNAL_URL` (Server) bzw. `NEXT_PUBLIC_PERSONA_BACKEND_URL` müssen auf die korrekte Persona-Backend-URL zeigen (z.B. `http://api:8000`).

3. **Proxy/Gateway**
   - Falls ein Reverse-Proxy oder API-Gateway vor dem Backend steht: sicherstellen, dass `GET` für `/ai-assist/*` und `/settings/*` zugelassen ist.

4. **Authentifizierung**
   - Beide Endpoints benötigen einen gültigen Auth-Header. Fehlende oder ungültige Auth kann je nach Setup zu 401/403 oder 404 führen.
