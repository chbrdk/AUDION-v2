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

- **OpenAI API Key:** Chat-API benötigt `OPENAI_API_KEY` (oder die in `core.config` verwendete Variable). Wenn nicht gesetzt, gibt `PersonaImageService.generate_portrait()` `None` zurück → Response `status: "failed"` (kein 500).

## Relevante Dateien

| Pfad | Rolle |
|------|--------|
| `apps/web/components/msqdx-glass-persona-admin-panel.tsx` | Button + `handleGenerateAvatar`, Fehler-Toast |
| `apps/web/app/api/persona-admin/[personaId]/generate-image/route.ts` | Next.js Proxy zum Chat-API |
| `apps/chat-api/app/routers/personas.py` | `generate_persona_image`, Profile-Normalisierung |
| `apps/chat-api/app/services/persona_image.py` | `PersonaImageService`, OpenAI Images API |
| `packages/proto/src/msqdx_glass_proto/personas.py` | `PersonaProfile`, `PersonaPainPoint`, `PersonaGoal`, `PersonaCommunicationStyle` |
