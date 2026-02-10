# Chat Share – URLs und Pfade

## Share-Link-Format

```
{origin}{basePath}/chat?personaId={personaId}&projectId={projectId}
```

- `personaId` (required): ID der Persona
- `projectId` (required): Projekt-ID (für Project-Context und Persona-Zugriff)

## Pfade (zentral, hier referenzieren)

| Pfad | Beschreibung |
|------|--------------|
| `/chat` | Eigenständige Chat-Seite (Share-Ziel) |
| `/admin/chat` | Admin-Chat (volles Layout) |
| `/admin/chat/history` | Chat-Verlauf |

## buildShareChatUrl()

Verwendung in `lib/share-chat.ts`:

```ts
import { buildShareChatUrl } from "@/lib/share-chat";
const url = buildShareChatUrl({ personaId, projectId });
```

## Ohne Login (Public Share)

Share-Links funktionieren **ohne Login**:
- `/chat` ist in `middleware.ts` als öffentlicher Pfad hinterlegt (`PUBLIC_PATHS`)
- Persona-Daten kommen von `/api/share/persona/{personaId}?projectId=xxx` (proxied zu Backend `GET /personas/{id}/public`)
- Chat-Nachrichten (message/stream) gehen direkt an die Chat-API, die keine Auth verlangt
- "Back to Admin" zeigt bei nicht eingeloggten Nutzern "Sign in" mit Link zu `/login`

## Hinweis

Aktuell teilt der Link nur die **Persona** – der Empfänger startet eine leere Konversation mit dieser Persona. Um den vollständigen Chat-Verlauf zu teilen, wäre ein Backend-API zum Speichern/Laden von geteilten Konversationen nötig.

## Styling (MSQDX)

Die Share-Chat-Seite (`/chat`) ist optisch an die Dashboard-Chat-Seite (`/admin/chat`) angeglichen:

- **Design-Tokens:** `var(--color-neutral)`, `var(--color-secondary-dx-green)`, `var(--color-text-primary)` etc.
- **Layout:** Gleicher Aufbau: Statuszeile (Sending…), Persona-Header, Nachrichtenbereich (1rem Padding), Input-Leiste (sticky, 720px max, runde Inputs, grüner Send-Button).
- **Dateien:** `apps/web/app/chat/page.tsx`, `apps/web/components/chat/chat-share-layout.tsx` (Header: „Chat“, Back to Admin / Sign in).

## Testing

- `buildShareChatUrl` kann mit Vitest getestet werden (wenn Vitest im Web-Workspace eingerichtet ist).
- Manuell: Share-Button klicken → Link kopieren → in neuem Tab öffnen → Chat mit Persona laden.
