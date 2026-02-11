# Avatar-Generierung (Admin Personas)

## Ablauf

1. **Frontend:** Admin Personas – Button „Avatar generieren“ (oder „Generate avatar“) in `apps/web/components/msqdx-glass-persona-admin-panel.tsx` → `handleGenerateAvatar()`.
2. **Request:** `POST /api/persona-admin/{personaId}/generate-image` (Next.js API Route).
3. **Next.js:** `apps/web/app/api/persona-admin/[personaId]/generate-image/route.ts` proxied an Chat-API: `GET getChatApiBase()/personas/{personaId}/generate-image` (POST).
4. **Chat-API:** `apps/chat-api/app/routers/personas.py` → `generate_persona_image()`:
   - Persona aus DB laden
   - `PersonaProfile` aus `persona.profile` bauen (typisierte Felder: `pain_points`, `goals`, `communication_style`)
   - `PersonaImageService().generate_portrait(profile, save_to_storage=True)` (OpenAI Image API, Modell `gpt-image-1-mini`)
   - Bei Erfolg: Persona `image_url` in DB speichern und zurückgeben

## Typische Ursache für 500

- **PersonaProfile-Validierung:** Das Proto-Modell `PersonaProfile` (msqdx_glass_proto) erwartet:
  - `pain_points`: Liste von `PersonaPainPoint` (label, evidence_count)
  - `goals`: Liste von `PersonaGoal` (label, priority)
  - `communication_style`: `PersonaCommunicationStyle` (vocabulary, sentence_structure, skepticism_level)
- Wenn `persona.profile` in der DB andere Formate hat (z. B. leeres `communication_style`, oder camelCase/Listen von Strings), wirft der Pydantic-Bau einen Fehler → 500.

## Fix (Chat-API)

In `apps/chat-api/app/routers/personas.py`:

- **Normalisierung:** Hilfsfunktionen `_normalize_pain_points`, `_normalize_goals`, `_normalize_communication_style` bauen aus dem Roh-`profile_dict` die richtigen Proto-Typen (inkl. camelCase und fehlender Felder).
- **Fehlerbehandlung:** `try/except` um den Aufbau des `PersonaProfile`; bei Fehler wird 500 mit `detail="Failed to build persona profile for image generation: {e}"` zurückgegeben, damit das Frontend die Meldung anzeigen kann.

## Konfiguration

- **Chat-API erreichbar:** Der **Web-Server** (Next.js) ruft beim Klick auf „Avatar generieren“ die **Chat-API** auf (`getChatApiBase()` + `/personas/{id}/generate-image`). Dafür muss `NEXT_PUBLIC_CHAT_API_URL` in der **Web-Umgebung** auf die laufende Chat-API zeigen (z. B. `http://audion-chat-api:8001` im gleichen Docker-Netzwerk). Ist die Chat-API nicht erreichbar (falsche URL, Service läuft nicht, DNS), antwortet die Next.js-Route mit **502** und `detail: "Chat API unreachable..."`.
- **OpenAI API Key:** Chat-API benötigt `OPENAI_API_KEY`. Wenn nicht gesetzt, gibt `PersonaImageService.generate_portrait()` `None` zurück → Response `status: "failed"` (kein 500).

## 500 „Internal Server Error“ – Checkliste

1. **Logs:** Die gezeigten API-Logs sind vom **Persona-Backend** (api:8000). Der Aufruf **generate-image** geht an die **Chat-API** (chat-api:8001). In den Logs der **Chat-API** sollte `POST /personas/{id}/generate-image` erscheinen, wenn der Request ankommt.
2. **Chat-API läuft:** Ist der Chat-API-Service gestartet und im gleichen Netzwerk wie die Web-App?
3. **NEXT_PUBLIC_CHAT_API_URL:** Im **Web-Service** gesetzt? Wert z. B. `http://audion-chat-api:8001` (Container-Name muss zum Deployment passen).
4. **Nach dem Fix:** Die Next.js-Route gibt bei Fehlern nun JSON mit `detail` zurück (502 wenn Chat-API nicht erreichbar, sonst Status/Body der Chat-API). Im UI erscheint dann die konkrete Meldung statt nur „Internal Server Error“.

## Datenbank: image_url Spalte

Die Tabelle `audion.personas` hat die Spalte `image_url`. Wenn die Chat-API keinen externen Storage (S3 o. Ä.) nutzt, speichert sie einen **Data-URL** (base64), der sehr lang ist (>512 Zeichen). Die Spalte war ursprünglich `VARCHAR(512)` → **StringDataRightTruncation**.

- **Migration:** `apps/api/alembic/versions/20260211_personas_image_url_text.py` – ändert `image_url` auf `TEXT`. Nach dem Ausführen der Migration (z. B. `alembic upgrade head` im API-Projekt) funktioniert das Speichern der generierten Avatare.
- **API-Model:** `apps/api/app/models/__init__.py` – `Persona.image_url` ist auf `Text` umgestellt (entspricht der Migration).

## Relevante Dateien

| Pfad | Rolle |
|------|--------|
| `apps/web/components/msqdx-glass-persona-admin-panel.tsx` | Button + `handleGenerateAvatar`, Fehler-Toast |
| `apps/web/app/api/persona-admin/[personaId]/generate-image/route.ts` | Next.js Proxy zum Chat-API; Fehlerbehandlung (502 wenn Chat-API unreachable, JSON mit `detail` bei 4xx/5xx) |
| `apps/chat-api/app/routers/personas.py` | `generate_persona_image`, Profile-Normalisierung |
| `apps/chat-api/app/services/persona_image.py` | `PersonaImageService`, OpenAI Images API |
| `packages/proto/src/msqdx_glass_proto/personas.py` | `PersonaProfile`, `PersonaPainPoint`, `PersonaGoal`, `PersonaCommunicationStyle` |
