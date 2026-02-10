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
| `common` | loading, save, cancel, delete, close, … |
| `nav` | Dashboard, Chat, Personas, Journeys, … |
| `auth` | login, register |
| `journeys` | Listen + `journeys.editor` (Editor) + `journeys.new` + `journeys.ai` (Snackbar) |
| `targetGroupsAdmin` | Target Group Admin Panel |
| `personaAdmin` | Persona Admin Panel |
| `queue` | Queue-Dashboard |
| `settings` | Settings, Projects, Providers, Theme, Prompts, API Docs |
| `upload` | Upload-Seite |

## Nächste Schritte (offen)

- ~~**Journey New** (`/admin/journeys/new`)~~ – erledigt
- ~~**Target Group Admin Panel**~~ – erledigt
- ~~**Persona Admin Panel**~~ – erledigt
- **Knowledge Sources Card:** `notify` prop
- **Chat/Persona-Listen:** Prüfen und ggf. übersetzen

## Zentraler Ort für Pfade

- `BRAND_COLOR` usw.: `apps/web/lib/branding.ts`
- Locale-Cookie: `audion_locale` (in i18n-provider)
