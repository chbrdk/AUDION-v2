# Prompts/Settings API – Fehlerbehebung

## Fehler 405 / 404 auf der Prompts-Seite

### Symptome

- `GET /api/ai-assist/templates` → **405 Method Not Allowed**
- `GET /api/settings/ai/templates?project_id=...` → **404 Not Found**
- `GET /api/settings/ai/persona-prompts` → **404 Not Found**
- Fehlermeldung: `Failed to load persona prompts: Error: {"detail":"Not Found"}`

### Ursache

Die Requests werden vom Next.js-Server an das Persona-Backend (Python FastAPI) weitergeleitet. Die Fehler stammen in der Regel vom Backend oder von der Routing-Konfiguration.

**Hinweis:** Fehlende Templates/Persona-Prompts sind *nicht* die Ursache. Die API gibt bei leeren Listen `200` + `[]` zurück, nie `404`.

### Änderung am Code (2025-02)

`listTemplates` nutzt nun den **Settings-Proxy** statt des ai-assist-Proxys:

- **Vorher:** `buildAiAssistUrl("/templates")` → `/api/ai-assist/templates`
- **Nachher:** `buildSettingsUrl("/ai/templates")` → `/api/settings/ai/templates`

Damit sind Templates-Liste, -Laden und -Speichern über dieselbe Proxy-Route (`/api/settings/*`) erreichbar.

### Resilience (2025-02)

`listTemplates` und `listPersonaPrompts` geben bei `404` nun ein leeres Array `[]` zurück statt einen Fehler zu werfen. Die UI funktioniert auch, wenn die Route temporär nicht erreichbar ist.

### Next.js 15+ params als Promise (2025-02)

In Next.js 15+ sind `params` in Route Handlern eine Promise. Wenn sie ohne `await` verwendet werden, ist `params.path` undefined → der Proxy baut falsche URLs (z.B. `/settings` statt `/settings/ai/templates`) → API 404. **Fix:** `const resolved = await params` vor der Nutzung. Betroffen: `api/settings`, `api/ai-assist`, `api/journeys`, `api/projects`.

### Default Templates bei Projekt-Erstellung (2025-02)

Beim Erstellen eines neuen Projekts (`POST /projects`) werden automatisch alle Default-Templates aus `templates.yaml` als Projekt-Overrides angelegt (`ai_template_overrides`). Jedes neue Projekt hat damit sofort alle Prompt-Templates verfügbar. Implementierung: `seed_default_templates_for_project()` in `apps/api/app/services/ai_assist.py`, aufgerufen aus `create_project` in `apps/api/app/routers/projects.py`.

### Checkliste für Deployment (405/404)

1. **Persona-Backend-Version prüfen**
   - Die Routen `/settings/ai/templates` und `/settings/ai/persona-prompts` müssen im Python-Backend existieren (`apps/api/app/routers/settings.py`).

2. **Coolify/Traefik Routing**
   - **Wichtig:** `/api/*` muss an die **Next.js-App (audion-web)** gehen, *nicht* direkt an die API.
   - Next.js leitet intern an `api:8000/settings/ai/...` weiter (ohne `/api`-Prefix).
   - Wenn `/api/*` direkt an die FastAPI geht, erhält diese `/api/settings/ai/templates`, die Route existiert aber unter `/settings/ai/templates` → **404**.

3. **Umgebungsvariablen**
   - `NEXT_PERSONA_BACKEND_INTERNAL_URL` (Server) bzw. `NEXT_PUBLIC_PERSONA_BACKEND_URL` müssen auf die korrekte Persona-Backend-URL zeigen (z.B. `http://api:8000`).

4. **Proxy/Gateway**
   - Falls ein Reverse-Proxy oder API-Gateway vor dem Backend steht: sicherstellen, dass `GET` für `/settings/*` zugelassen ist.

5. **Authentifizierung**
   - Beide Endpoints benötigen einen gültigen Auth-Header. Fehlende oder ungültige Auth kann zu 401/403 führen.

## AI Assist: Persona Traits liefert leere Vorschläge (200 OK, 0 Suggestions)

### Symptome

- `POST /ai-assist?project_id=...` mit Template `persona.traits` → **200 OK**
- Logs: `has_content: false`, `content_length: 0`, `finish_reason: "length"`, `usage_output_tokens: 600`
- Frontend erhält `suggestions: []`

### Ursachen

1. **Content-Format:** Manche Modelle/APIs liefern `message.content` als Liste von Content-Parts (z. B. bei Reasoning/Thinking). Der Code las nur `choice.message.content` als String → bei Liste war das Ergebnis leer.
2. **Token-Limit:** Mit `max_tokens: 600` und `finish_reason: "length"` kann die Antwort abgeschnitten sein (z. B. nur Präambel, kein JSON).

### Änderungen (2026-02)

- **`apps/api/app/services/ai_assist.py`:** Content-Extraktion unterstützt jetzt sowohl `str` als auch `list` von Content-Parts (z. B. `part.text` oder `part["text"]`).
- **`apps/api/app/prompts/templates.yaml`:** Template `persona.traits` hat `max_tokens` von 600 auf **1024** erhöht, damit das JSON sicher ins Limit passt.
- Optional: In den Projekt-Settings (AI/Templates) für `persona.traits` `max_tokens` weiter erhöhen, falls nötig.
