# AUDION Monochrom-Theme

## Varianten

| Modus | Storage | Look |
|-------|---------|------|
| **Monochrom (dunkel)** | `monochrome-dark` | Weißer Canvas + weiße Sidebar, schwarzer App-Inhalt, weiße Ränder (Original) |
| **Monochrom (hell)** | `monochrome-light` | Invertiert: schwarzer Canvas + schwarze Sidebar, weißer App-Inhalt, schwarze Ränder |

Legacy: `monochrome` in LocalStorage wird zu `monochrome-dark` gemappt.

## Aktivierung

- `data-theme="monochrome-dark"` oder `data-theme="monochrome-light"` auf `<html>`
- LocalStorage: `audion-theme-mode`
- UI: **Einstellungen → Theme** (4 Buttons) oder Profil → Darstellung
- Sidebar-Toggle rotiert: light → dark → monochrome-dark → monochrome-light → light

## Dateien

- `apps/web/styles/monochrome-theme.css` — Tokens + gemeinsame Komponenten-Regeln
- `apps/web/lib/theme-mode.ts` — Modus-Typen, Migration, `isMonochromeMode()`
- `apps/web/lib/brand-color-utils.ts` — `applyMonochromeDarkBrandVars()` / `applyMonochromeLightBrandVars()`
- `apps/web/components/theme-registry-ssr-safe.tsx` — MUI-Themes + Toggle
- `apps/web/components/admin/msqdx-glass-admin-layout.tsx` — Chrome-Farben pro Variante

## Hinweise

- Sidebar-Farbwahl ist in beiden Monochrom-Modi deaktiviert.
- `globals.css` / `admin.css` nutzen `[data-theme="monochrome-dark"], [data-theme="monochrome-light"]` für gemeinsame Dark-Basis; variantenspezifische Overrides in `monochrome-theme.css` und `admin.css`.
