# Admin-Chat: Höhe, Scroll, Composer

## Scroll-Verantwortung

- **`MsqdxGlassChatPanel`** (`apps/web/components/msqdx-glass-chat-panel.tsx`) rendert nur den Nachrichten-Stack **ohne** eigenes `overflow` / `height: 100%`. Scroll passiert im **Eltern-Container** (Admin-Chat: absolut positionierter Bereich; Share-Chat: äußere Message-`Box`).

## Admin-Chat (`apps/web/app/admin/chat/page.tsx`)

- Äußerer Chat-Block: `height: 100%`, `minHeight: 0`, `position: relative`.
- Nachrichtenbereich: `position: absolute`, `inset: 0`, `overflowY: auto`, **`paddingBottom`** groß genug, damit der letzte Text unter der Eingabezeile bleibt (Bar-Höhe variiert nach Breakpoints).
- **Composer** (`form`): `position: absolute`, `bottom: 0`, `left/right: 0`, **`zIndex: 20`**, leicht transparenter Hintergrund + Blur, Schatten nach oben — liegt **über** dem Scroll-Inhalt, nicht darunter im Flow.

Bei Layout-Problemen zuerst die Kette `MsqdxGlassAdminLayout` → `main.msqdx-glass-admin-content` (füllt Viewport) und dann `minHeight: 0` auf Flex-Kindern prüfen.
