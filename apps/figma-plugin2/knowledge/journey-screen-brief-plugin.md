# Figma plugin: Journey → screen prompt (CREATION)

## Behavior

- **Journeys** view: after selecting a journey, choose **phase**, **persona**, optional **target group**, then:
  - **Build screen prompt only** — calls CREATION `POST /api/v1/journey-screen-brief` and stores the screen prompt for **Seite in Figma generieren** (no separate Prompt→Site card).
  - **Build prompt + generate page** — same brief, then chains `prompt-site-to-figma`.
- After a successful Figma insert, **`prompt-site-to-figma-success`** includes **`importedSections`**: rows built in `code.ts` via `buildImportedSectionRow` (from layer `msqdxSectionConceptPayload`). **`JourneySectionsPanel`** lists them and shows JSON metadata; clicking a row posts **`select-scene-node`** so the main thread selects and zooms to that frame.
- **Fixed pipeline (no UI choice):** `componentLibrary: "default"` and `renderMode: "free"` (native LLM) only — see `src/config/journey-prompt-site.ts`. Viewport (desktop/tablet/mobile) remains selectable for capture size.
- API path is **`CREATION_JOURNEY_SCREEN_BRIEF_PATH`** in `src/config/urls.ts` (not hardcoded in `code.ts` beyond that import).

## Backend contract & privacy

See **CREATION** repo: `knowledge/journey-persona-screen-pipeline.md`.

## Payload helper

`buildJourneyScreenBriefRequestBody` in `src/services/journey-screen-brief-payload.ts` — covered by `journey-screen-brief-payload.test.ts`.

## UI layout (Figma iframe)

- Main scroll area in `ui.tsx` uses **`minHeight: 0`** on the flex child with `flex: 1` + `overflow-y: auto` so the plugin can scroll and buttons receive clicks (without it, content can clip or hit-testing fails).
- **`JourneysPanel`** must not use **`height: 100%`** on its root when stacked above the sections panel — that pattern steals the full viewport height inside nested flex layouts and causes “overlay” / dead-click behaviour in the sandboxed UI.
