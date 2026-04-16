# Persona „Mit KI generieren“ (Admin-Übersicht)

- **UI**: `apps/web/components/personas/msqdx-glass-personas-overview.tsx` — Icon „auto_awesome“ auf der gestrichelten „Neue Persona“-Karte öffnet einen Dialog (Zielgruppe Pflicht, optionales Segment, Freitext-Fokus).
- **API**: `generateTargetGroupPersona` → `POST /api/target-groups/{id}/personas/generate` (`apps/web/app/api/_lib/target-group.ts`, Timeout-Proxy `personas/generate/route.ts`).
- **Backend-Prompt**: `apps/api/app/services/persona_generation.py` — Funktion `_compose_identity_context_block` ergänzt den LLM-Prompt um **Projekt `company_context` / `description`**, **Zielgruppe** (Name, Segment, Beschreibung) sowie **Nutzer-Brief** aus `Persona.segment` / `Persona.headline` (Headline kommt aus `TargetGroupPersonaGenerateRequest.description` via `persona_bootstrap`).
- **Strings**: `personaAdmin.generateWithAi*` in `apps/web/locales/de.json` / `en.json`.
