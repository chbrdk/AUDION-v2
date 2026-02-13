# AUDION i18n – Mehrsprachigkeit

## Übersicht

AUDION nutzt ein eigenes i18n-System mit JSON-Übersetzungsdateien und Platzhaltern (`{key}`) für dynamische Werte.

## Struktur

- **Übersetzungsdateien:** `apps/web/locales/en.json`, `apps/web/locales/de.json`
- **Kernlogik:** `apps/web/lib/i18n/index.ts` – `createTranslator`, `resolveLocale`, Interpolation
- **Server:** `apps/web/lib/i18n/server.ts` – `getServerLocale()`, `getServerT()` (async)
- **Provider:** `apps/web/components/i18n/i18n-provider.tsx` – `I18nProvider`, `useI18n()`

## Verwendung

### Client Components

```tsx
import { useI18n } from "../i18n/i18n-provider";

function MyComponent() {
  const { t, locale, setLocale } = useI18n();
  return <span>{t("journeys.editor.phase")}</span>;
}
```

### Server Components

```tsx
import { getServerT } from "../../lib/i18n/server";

export default async function Page() {
  const t = await getServerT();
  return <h1>{t("journeys.title")}</h1>;
}
```

### Platzhalter

```ts
t("journeys.editor.deleteConfirm", { name: phase.name })
// → "Do you really want to delete the phase "Awareness"?"
// Key: "deleteConfirm": "Do you really want to delete the phase \"{name}\"?"
```

### Unterstützte Sprachen

- `en` (Standard)
- `de`

Sprache wird aus Cookie `audion_locale` oder `Accept-Language`-Header ermittelt.

## Wichtige Namespaces

| Namespace | Inhalt |
|-----------|--------|
| `common` | loading, save, cancel, delete, close, add, remove, edit, unknownError, toggleNavigation, togglePanel, … |
| `nav` | Dashboard, Chat, Personas, Journeys, … |
| `auth` | login, register |
| `journeys` | Listen + `journeys.editor` (Editor, Phase Card, aria-labels, phaseNameLabel, cancelEditing, phaseCardAria) + `journeys.new` + `journeys.ai` (Snackbar) |
| `targetGroupsAdmin` | Target Group Admin Panel, Persona Create Dialog (segmentHelperText, …) |
| `personaAdmin` | Persona Admin Panel, Persona-Liste, Dashboard Cards (Basics, Bio, Communication, Advanced), Pain Points & Goals, Personality, Bio Card Edit (gender, demographics, …) |
| `queue` | Queue-Dashboard |
| `settings` | Settings, Projects, Providers, Theme, Prompts, API Docs |
| `upload` | Upload-Seite |
| `knowledgeSources` | Knowledge & Sources Card (Documents, Knowledge Base, Sources, Insights, Alerts) |
| `backend` | Backend-Fehler (errorTitle, errorBody, selectProject) |
| **`adminChat`** | Admin Chat Page: sending, placeholder, choosePersona, addJourneyPhases, shareChatLink, togglePlayback, journeyPhases, variables, attachments, loadingPersonas, noPersonasAvailable, linkCopied, copyFailed, journey, noneAvailable, loading, copyLink, copied, stopRecording, startVoiceInput |
| **`chatHistory`** | Chat History Page: title, subtitle, searchPlaceholder, persona, allPersonas, showArchived, deleteConfirm |
| **`chat`** | Chat-Seite (User): personaFallback, errors, placeholder, demographics, interests, values, loading, … |
| **`promptBuilder`** | collapsePanel, expandPanel, closeResult, closeError, searchVariables |
| **`chipEditor`** | aiSuggestion, editChips, addEntryPlaceholder, emptyEntries (common.add/remove) |

## Erledigte i18n-Bereiche

- ~~**Journey New** (`/admin/journeys/new`)~~ – erledigt
- ~~**Target Group Admin Panel**~~ – erledigt
- ~~**Persona Admin Panel**~~ – erledigt
- ~~**Knowledge Sources Card**~~ – erledigt (`knowledgeSources.*`)
- ~~**Projects Overview**~~ – Fehlermeldung nutzt `settingsProjects.errors.createProject`
- ~~**Persona Dashboard Cards**~~ – erledigt (`personaAdmin.*` für Basics, Bio, Communication, Advanced, Pain Points & Goals, Personality, Bio Card Edit)
- ~~**Chat-Seite (User)**~~ – Namespace `chat.*`
- ~~**Personas Overview**~~ – `personaAdmin.loadListFailed`, `personaAdmin.newPersona`, `common.unknownError`, `common.edit`
- ~~**Admin Chat**~~ – erledigt (`adminChat.*`, inkl. Tooltips, notify, Suspense-Fallback)
- ~~**Persona-Liste**~~ – erledigt (`personaAdmin.openPersona`, `personaAdmin.emptyInTargetGroup`, statuses, deleteConfirm, aria-labels)
- ~~**Persona Create Dialog**~~ – erledigt (`targetGroupsAdmin.*`, `common.cancel`)
- ~~**Pain Points & Goals / Personality / Bio Card Edit**~~ – erledigt (`personaAdmin.*`, `chat.interests`/`chat.values`)
- ~~**Chip-Editor + AI-Button-Icon**~~ – erledigt (`chipEditor.*`, `common.add`/`common.remove`)
- ~~**Journey-Editor + Phase Card**~~ – erledigt (aria-labels, phaseNameLabel, cancelEditing, phaseCardAria, durationMin/Max, expectedEmotion, editPhase)
- ~~**Chat History**~~ – erledigt (`chatHistory.*`)
- ~~**Admin Layout**~~ – erledigt (`common.toggleNavigation`, `common.togglePanel`)
- ~~**Prompt-Builder**~~ – erledigt (`promptBuilder.*` in ResizablePanel, PreviewPanel, VariablePalette)
- ~~**Chat Layout**~~ – erledigt (Suspense-Fallback `ChatLayoutLoadingFallback` mit `common.loading`)

## Noch offen / optional

- **Stories (Storybook)** – optional: `KnowledgeSourcesCard`, `TargetGroupAdminPanel`, `BioCardEdit`, `PersonaBasicsCard`, `ChipEditor`, `PersonaAdminPanel`, `UploadDropzone` etc. können bei Bedarf auf `t()` umgestellt werden.

## Zentraler Ort für Pfade

- `BRAND_COLOR` usw.: `apps/web/lib/branding.ts`
- Locale-Cookie: `audion_locale` (in i18n-provider)
