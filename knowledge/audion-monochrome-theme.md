# AUDION Monochrom-Theme

## Aktivierung

- `data-theme="monochrome"` auf `<html>`
- LocalStorage: `audion-theme-mode` = `monochrome`
- UI: **Einstellungen → Theme** oder **Profil → Darstellung** → Button „Monochrom“

## Look & Feel (invertiert)

| Element | Wert |
|--------|------|
| Canvas (`html`/`body`) | `#000000` (`--audion-mono-canvas-bg`) |
| App-Inhalt (main, inner) | `#ffffff` (`--audion-mono-page-bg`) |
| Karten/Flächen | `#f5f5f5` (`--audion-mono-surface`) |
| Ränder | `#000000` (`--audion-mono-border`) |
| Akzent | Schwarz (`--color-theme-accent`) |
| Sidebar (Chrome) | `#000000` — schwarz mit weißen Icons/Logo |
| App-Rahmen (inner) | Schwarzer Rand auf weißem Content |

## Dateien

- `apps/web/styles/monochrome-theme.css` — Tokens & Overrides
- `apps/web/lib/brand-color-utils.ts` — `applyMonochromeBrandVars()`
- `apps/web/components/theme-registry-ssr-safe.tsx` — MUI `monochromeTheme` (light palette)
- `apps/web/components/admin/msqdx-glass-admin-layout.tsx` — Chrome-Farben & `innerBackgroundColor`
- Dark-Selektoren in `globals.css` teilen Regeln mit Monochrome; Monochrome-Datei überschreibt gezielt

## Hinweise

- Sidebar-Farbwahl ist im Monochrom-Modus deaktiviert.
- `toggleTheme()` rotiert: light → dark → monochrome → light (Sidebar).
