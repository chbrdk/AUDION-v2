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

## Hinweis

Aktuell teilt der Link nur die **Persona** – der Empfänger startet eine leere Konversation mit dieser Persona. Um den vollständigen Chat-Verlauf zu teilen, wäre ein Backend-API zum Speichern/Laden von geteilten Konversationen nötig.

## Testing

- `buildShareChatUrl` kann mit Vitest getestet werden (wenn Vitest im Web-Workspace eingerichtet ist).
- Manuell: Share-Button klicken → Link kopieren → in neuem Tab öffnen → Chat mit Persona laden.
