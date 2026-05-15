# AUDION Monochrom-Theme

## Aktivierung

- `data-theme="monochrome"` auf `<html>`
- LocalStorage: `audion-theme-mode` = `monochrome`
- UI: **Einstellungen → Theme** oder **Profil → Darstellung** → Button „Monochrom“

## Look & Feel

| Element | Wert |
|--------|------|
| Canvas (`html`/`body`) | `#ffffff` (`--audion-mono-canvas-bg`) |
| App-Inhalt (main) | `#000000` (`--audion-mono-page-bg`) |
| Karten/Flächen | `#0a0a0a` (`--audion-mono-surface`) |
| Ränder | `#ffffff` (`--audion-mono-border`) |
| Akzent (Ränder) | Weiß (`--color-theme-accent`) |
| Sidebar (Chrome) | `#ffffff` (`--audion-chrome-surface`) — weiß mit schwarzen Icons/Logo |
| App-Inhalt (inner) | `#000000` — wie Dark Mode, kein Offwhite |

**Hinweis:** Im Monochrom-Modus ist nur die Sidebar invertiert (weiß/schwarz). Der App-Hintergrund bleibt schwarz (`innerBackgroundColor: #000000`).

## Dateien

- `apps/web/styles/monochrome-theme.css` — Border-/Surface-Overrides
- `apps/web/lib/theme-mode.ts` — Typen & Storage-Key
- `apps/web/components/theme-registry-ssr-safe.tsx` — MUI `monochromeTheme`
- Dark-Selektoren in `globals.css`, `dashboard-cards.css`, `admin.css` nutzen `[data-theme="dark"], [data-theme="monochrome"]`

## Hinweise

- Sidebar-Farbwahl ist im Monochrom-Modus deaktiviert.
- `toggleTheme()` rotiert: light → dark → monochrome → light (Sidebar).
