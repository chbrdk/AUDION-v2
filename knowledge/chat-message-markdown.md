# Chat: Markdown in Antworten

Persona- und Admin-Chat rendern Nachrichtentext mit **`ChatMessageMarkdown`** (`apps/web/components/chat/chat-message-markdown.tsx`): `react-markdown` + **remark-gfm** (Tabellen, Durchstreichung, …) + **remark-breaks** (einzelne Zeilenumbrüche wie in Chat üblich).

Eingebunden in:

- `components/msqdx-glass-chat-panel.tsx` (Share-Chat + Admin-Chat Hauptthread)
- `app/admin/chat/page.tsx` (Zielgruppen-„Alle fragen“-Karten)

Links öffnen in einem neuen Tab (`rel="noopener noreferrer"`). Kein rohes HTML aus dem Modell (kein `rehype-raw`).
