# Inventar: LLM-Output → Datenbank / persistente Artefakte (AUDION-v2)

Zweck: Grundlage für **zweisprachige Inhalte (de/en)** oder andere Lokalisierungsstrategien.  
Stand: manuell aus dem Repo abgeleitet (Services + Router + chat-api).

Legende: **Persistiert** = wird in DB, Dateisystem oder Vektorstore geschrieben und von Dashboard/API konsumiert. **Streaming** = primär transient (kann trotzdem geloggt/gespeichert werden).

---

## apps/api (Persona-API)

### Persona & Profil

| Bereich | Datei / Einstieg | LLM | Persistenz |
|--------|-------------------|------|-------------|
| Persona-Identität (JSON-Profil) | `app/services/persona_generation.py` → `PersonaGenerationService.generate` | OpenAI oder Anthropic (Stream) | `Persona.profile`, `Persona.name`, `Persona.headline`, `Persona.confidence`; `PersonaPrompt` |
| Persona anlegen + Generierung | `app/services/persona_bootstrap.py` → `generate_persona_for_target_group` | ruft `persona_generation` | `Persona`-Zeile + obiges Profil |
| Router: Zielgruppe | `app/routers/target_groups.py` → `POST .../personas/generate` | indirekt | wie oben |
| Router: Persona | `app/routers/personas.py` → `POST .../generate` | `PersonaGenerationService` | wie oben |
| Pain points / Interests / Values / Goals (einzeln) | `app/routers/personas.py` | `AIAssistService.generate` | Merge in `Persona.profile` (je nach Handler) |
| Persona enrich (Batch) | `app/routers/personas.py` (enrich) | mehrere `ai_assist.generate` | `Persona.profile` |
| Persona-Discovery | `app/services/persona_discovery.py` | Anthropic `messages.create` | Primär **Antwort an Client** (z. B. `app/ws/chat.py`); keine feste Profil-Persistenz im Service selbst |
| Chat-Agent (Admin-Kontext) | `app/agents/persona.py` | Anthropic stream | typischerweise **nicht** Profil-DB; Streaming-Antwort |

### Journeys

| Bereich | Datei / Einstieg | LLM | Persistenz |
|--------|-------------------|------|-------------|
| Journey aus Wissen | `app/services/journey_generation.py` | `AIAssistService.generate` / Claude-Pfad | Journey-Entwurf + Phasen (DB-Modelle Journey/Phase/…) |
| Celery-Task | `app/tasks/journey_tasks.py` → `generate_journey_task` | `JourneyGenerationService` | wie oben |
| Router sync/async | `app/routers/journeys.py` (`/generate`, ggf. Task) | oben | DB |
| Journey AI Content | `app/routers/journeys.py` → `generate_journey_ai_content` | `AIAssistService` | journey-bezogene Inhalte (Endpunktdetail in Router) |
| Journey-Insights aus Messungen | `app/services/insight_generation.py` | Anthropic | `JourneyInsight`: u. a. `title`, `description`, `ai_analysis`, `ai_recommendations`, `evidence` (siehe `analyze_measurements`) |

### Vorschläge (Suggest)

| Bereich | Datei | LLM | Persistenz |
|--------|--------|------|-------------|
| Target-Group-Vorschläge | `app/services/suggest_target_groups.py` | OpenAI chat | Antwort an Client; Persistenz abhängig vom Router (z. B. Entwurf speichern) |
| Persona-Vorschläge | `app/services/suggest_personas.py` | OpenAI chat | wie oben |

### Moodboards & Medien

| Bereich | Datei | LLM / API | Persistenz |
|--------|--------|------------|-------------|
| Moodboard (Openverse / OpenAI-Bilder) | `app/services/moodboard_service.py` | OpenAI Images + ggf. Prompt-Text | Tiles in DB + Blobs/Keys in Storage; **Bilder** sind nicht „Übersetzungstext“, Prompts schon |
| OpenAI Images Client | `app/services/openai_images_client.py` (falls vorhanden) | Images API | PNG-Pfade |

### Generischer AI-Endpunkt

| Bereich | Datei | LLM | Persistenz |
|--------|--------|------|-------------|
| AI Assist | `app/services/ai_assist.py` + `app/routers/ai_assist.py` | Anthropic oder OpenAI | **Konfigurations-/Template-abhängig**; von Personas, Journeys, anderen Routern genutzt |

### Nicht-LLM / eingrenzen

- **`app/services/easy_setup_url.py`**: URL-Fetch + Text für `company_context` — **kein LLM**, aber **mehrsprachiger** User-Content möglich.
- **Embeddings / Qdrant** (`target_groups.py` Kommentare, Ingestion): numerische Vektoren, keine UI-Sprache pro Feld — Lokalisierung betrifft **Quelltext der Chunks**, nicht das Embedding.

---

## apps/chat-api

| Bereich | Datei | LLM | Persistenz |
|--------|--------|------|-------------|
| Chat-Stream | `app/agents/persona.py`, `app/routers/chat_stream.py`, `app/routers/chat.py`, `app/routers/voice.py` | OpenAI (Stream) | Messages / Sessions je nach Persistenzlayer des Chat-API (separat von Persona-Profil in API-DB) |
| Turn naturalness (Stil-Addendum, Session) | `app/utils/turn_naturalness.py`, `app/utils/turn_session_store.py` | — (Heuristik + ggf. Zufall) | **In-Memory** pro `session_id` (HTTP) / WebSocket-Verbindung; kein DB-Write; siehe `knowledge/turn-naturalness.md` |
| Persona-Generierung (Duplikat/älterer Pfad?) | `app/services/persona_generation.py` | Anthropic | prüfen, ob noch produktiv oder Legacy |
| Persona-Discovery | `app/services/persona_discovery.py` | Anthropic | wie api |
| Persona-Avatar / Bild | `app/services/persona_image.py` | OpenAI | Bild-URL oder Binary — keine zweisprachigen „Texte“, außer Metadaten |

---

## Empfohlene Reihenfolge für „de/en im gespeicherten LLM-Text“

1. **Ein Schema** für lokalisierte Strings (`{"de":"...","en":"..."}` oder `LocalizedString`) und **eine Resolver-Hilfe** (Fallback en → de).
2. **`Persona.profile`** + Proto `PersonaProfile` (`packages/proto`) + **Web-Typen** (`packages/types`, Admin-Panel) — ein End-to-End-Schnitt.
3. **Journey-Phasen** (Titel, Beschreibung, Emotionstext, …) — zweite Welle.
4. **`JourneyInsight`** und andere **Insight-Texte**.
5. **Generischer `ai_assist`**: Output-Schemas pro `template_id` / Use-Case taggen.
6. **Chat-API**: nur wenn Unterhaltungen **sprachabhängig gespeichert** werden sollen (oft getrennt von Marketing-Persona-Profil).

---

## Wartung

Bei neuen Features: dieses Dokument um **Service + Router + DB-Tabelle/JSON-Feld** ergänzen.
