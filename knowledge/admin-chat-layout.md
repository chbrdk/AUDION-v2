# Admin-Chat: Höhe, Scroll, Composer

## Scroll-Verantwortung

- **`MsqdxGlassChatPanel`** (`apps/web/components/msqdx-glass-chat-panel.tsx`) rendert nur den Nachrichten-Stack **ohne** eigenes `overflow` / `height: 100%`. Scroll passiert im **Eltern-Container** (Admin-Chat: absolut positionierter Bereich; Share-Chat: äußere Message-`Box`).

## Admin-Chat (`apps/web/app/admin/chat/page.tsx`)

- Äußerer Chat-Block: `height: 100%`, `minHeight: 0`, `position: relative`.
- Nachrichtenbereich: `position: absolute`, `inset: 0`, `overflowY: auto`, **`paddingBottom`** groß genug, damit der letzte Text unter der Eingabezeile bleibt (Bar-Höhe variiert nach Breakpoints).
- **Composer**: Das **`form`** ist nur noch der volle Breite liegende Overlay-Container (`position: absolute`, `bottom: 0`, `zIndex: 20`, Padding, ohne Vollflächen-Hintergrund). Sichtbarer **„Chip“** ist die innere **`Box`** mit `maxWidth: 720px`, `mx: auto`: Border, **`borderRadius`** (`9999px` — volle Pillenform auf der Toolbar-Karte), **Hintergrund**, Blur und Schatten. Optionaler Whisper-Status sitzt in derselben Karte unter der Icon-Zeile.

Bei Layout-Problemen zuerst die Kette `MsqdxGlassAdminLayout` → `main.msqdx-glass-admin-content` (füllt Viewport) und dann `minHeight: 0` auf Flex-Kindern prüfen.
