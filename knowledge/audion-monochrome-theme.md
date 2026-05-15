# AUDION Monochrom-Theme

## Aktivierung

- `data-theme="monochrome"` auf `<html>`
- LocalStorage: `audion-theme-mode` = `monochrome`
- UI: **Einstellungen → Theme** oder **Profil → Darstellung** → Button „Monochrom“

## Look & Feel

| Element | Wert |
|--------|------|
| Seitenhintergrund | `#000000` (`--audion-mono-page-bg`) |
| Karten/Flächen | `#0a0a0a` (`--audion-mono-surface`) |
| Ränder | `#ffffff` (`--audion-mono-border`) |
| Akzent (Ränder) | Weiß (`--color-theme-accent`) |
| Chrome (Sidebar/Shell) | `#0a0a0a` (`--audion-chrome-surface`) — **nicht** weiß |

**Häufiger Fehler:** `--audion-light-border-color` ist die Sidebar-Hintergrundfarbe (Brand), nicht die Border-Farbe. Im Monochrom-Modus muss sie dunkel bleiben, sonst sind weiße Icons unsichtbar.

## Dateien

- `apps/web/styles/monochrome-theme.css` — Border-/Surface-Overrides
- `apps/web/lib/theme-mode.ts` — Typen & Storage-Key
- `apps/web/components/theme-registry-ssr-safe.tsx` — MUI `monochromeTheme`
- Dark-Selektoren in `globals.css`, `dashboard-cards.css`, `admin.css` nutzen `[data-theme="dark"], [data-theme="monochrome"]`

## Hinweise

- Sidebar-Farbwahl ist im Monochrom-Modus deaktiviert.
- `toggleTheme()` rotiert: light → dark → monochrome → light (Sidebar).
