# AUDION Dashboard – Design-Regeln für zukünftige Apps

Dieses Dokument leitet aus dem AUDION-Dashboard **genaue Regeln** für Elemente, Styling, Abstände, Border-Radius und Tokens ab. Es dient als zentrale Referenz für die konsistente Umsetzung weiterer Apps.

---

## 1. Design-Tokens (immer verwenden, nie hardcoden)

### Spacing
| Token | Wert | Verwendung |
|-------|------|------------|
| `--msqdx-spacing-xxs` | 4px | Minimale Abstände |
| `--msqdx-spacing-xs` | 8px | Kleine Innenabstände, Icon-Gaps |
| `--msqdx-spacing-sm` | 12px | Button-Padding, kompakte Bereiche |
| `--msqdx-spacing-md` | 16px | Standard-Innenabstand, Header-Padding |
| `--msqdx-spacing-lg` | 18px | — |
| `--msqdx-spacing-xl` | 24px | Card-Content-Padding, Grid-Gap |
| `--msqdx-spacing-xxl` | 32px | Grid-Gap (Dashboard-Cards), Toggle-Button-Größe |

### Border-Radius
| Token | Wert | Verwendung |
|-------|------|------------|
| `--msqdx-radius-xs` | 4px | Kleine Elemente, Scrollbar |
| `--msqdx-radius-sm` | 8px | Accordion, Create-Form, Inputs, kleine Karten |
| `--msqdx-radius-md` | 20px | — |
| `--msqdx-radius-3xl` | **24px** | **Dashboard-Cards** (Standard für Karten) |
| `--msqdx-radius-lg` | 40px | Große runde Elemente |

Zusätzlich im Code verwendet:
- **12px** – Card-Icon-Container (`border-radius: 12px`)
- **16px** – Settings-Card, Chips (16px), Color-Swatch (8px)
- **18px** – Journey-Phase, Avatar (18px)
- **20px** – Dashboard-Chip (`.--dashboard`: `border-radius: 20px`)
- **999px** – Pill-Buttons, Links, Status-Pill, Badge (voll rund)

### Typography
| Token | Wert | Verwendung |
|-------|------|------------|
| `--msqdx-font-size-sm` | 0.875rem | Section-Labels, Chips, kleine Texte |
| `--msqdx-font-size-base` | 1rem | Body |
| `--msqdx-font-size-lg` | 1.125rem | Card-Header (h3) |

Weitere feste Werte im Dashboard:
- **0.75rem** – Meta, Caption, Chip klein, Label
- **0.8rem** – Eyebrow
- **0.8125rem** – List-Item strong, Button
- **0.875rem** – Section h4 (uppercase), Dashboard-Chip Basis
- **1rem** – Accordion h3, Panel h2
- **1.125rem** – Card-Header h3 (Dashboard-Card)

### Transition
| Token | Wert |
|-------|------|
| `--msqdx-transition` | 0.3s ease |
| `--msqdx-transition-fast` | 0.2s ease |

---

## 2. Farben (CSS-Variablen, themenfähig)

### Primär / Hintergrund
- **Karten-Hintergrund (Light):** `var(--color-primary-white, #ffffff)`
- **Karten-Hintergrund (Dark):** `var(--color-background, #1a1a1a)` bzw. `var(--color-primary-white)` mit Dark-Override
- **Neutral (Flächen):** `var(--color-neutral)` – Light: `#f8f6f0`, Dark: `#0f0f0f`

### Theme-Akzent (wichtig für alle Apps)
- **Rahmen, Buttons, aktive Zustände:** `var(--color-theme-accent)`
- **Tint (Hover/Background):** `var(--color-theme-accent-tint)`
- Im Admin-Bereich: Inputs, Buttons, Borders, aktive List-Items nutzen durchgehend `--color-theme-accent`.

### Text
- **Primär:** `var(--color-text-primary)`
- **Sekundär / Muted:** `var(--color-text-secondary)` oder `#475569` / `#94a3b8`

### DX-Palette (semantisch)
| Bedeutung | Farbe | Tint (Hintergrund) |
|-----------|--------|---------------------|
| Akzent/Bio | `--color-theme-accent` | `--color-theme-accent-tint` |
| Persönlichkeit | `--color-secondary-dx-yellow` | `--color-secondary-dx-yellow-tint` |
| Pain/Goals | `--color-secondary-dx-pink` | `--color-secondary-dx-pink-tint` |
| Kommunikation | `--color-secondary-dx-blue` | `--color-secondary-dx-blue-tint` |
| Wissen | `--color-secondary-dx-green` | `--color-secondary-dx-green-tint` |
| Advanced | `--color-secondary-dx-orange` | `--color-secondary-dx-orange-tint` |
| Grey (Borders) | `--color-secondary-dx-grey-light` | `--color-secondary-dx-grey-light-tint` |

### Borders (Standard)
- **Karten/Light:** `1px solid var(--color-secondary-dx-grey-light-tint)` oder `var(--color-theme-accent)` im Admin
- **Dark:** `1px solid rgba(255,255,255,0.1)` für Karten, sonst Theme-Akzent

---

## 3. Seiten-Layout (Admin/Dashboard)

### Admin-Page Container
- **Klasse:** `.msqdx-glass-admin-page`
- **Layout:** `display: flex; flex-direction: column; gap: 2rem; padding: 2rem;`

### Admin-Header
- **Klasse:** `.msqdx-glass-admin-header`
- **Layout:** `display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 1rem;`
- **Eyebrow:** `.msqdx-glass-eyebrow` – `text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.8rem; font-weight: 600;`
- **Subtitle:** `.msqdx-glass-subtitle` – `margin: 0.5rem 0 0; color: #475569;`
- **Actions:** `.msqdx-glass-admin-actions` – `display: flex; gap: 0.75rem; flex-wrap: wrap;`

### Admin-Grid (Sidebar + Content)
- **Klasse:** `.msqdx-glass-admin-grid`
- **Grid:** `grid-template-columns: minmax(64px, 280px) minmax(0, 1fr); gap: 1rem;`
- Sidebar collapsed: 64px; expanded: 280px.
- **Breakpoint 1200px:** eine Spalte, Sidebar volle Breite.

### Panel
- **Wrapper:** `.msqdx-glass-panel-wrapper` – Breite 64px (collapsed) / 280px (expanded)
- **Panel:** `.msqdx-glass-panel` – `border-radius: 0; padding: 0; gap: 1rem;`
- **Panel-Header:** `.msqdx-glass-panel__header` – `padding: 0.5rem; padding-top: 2.5rem; gap: 0.75rem;`
- **Panel h2:** `font-size: 1rem; font-weight: 600; margin: 0;`

---

## 4. Karten (Cards)

### Dashboard-Card (Persona-Detail, klappbar)
- **Klasse:** `.msqdx-glass-dashboard-card`
- **Border:** `1px solid var(--color-secondary-dx-grey-light-tint)` (Dark: `rgba(255,255,255,0.1)`)
- **Border-Radius:** `var(--msqdx-radius-3xl)` = **24px**
- **Padding:** 0 (overflow hidden), Content: `var(--msqdx-spacing-xl)` (24px)
- **Transition:** `all var(--msqdx-transition)`
- **Header:** `.msqdx-glass-dashboard-card-header` – `padding: var(--msqdx-spacing-md) var(--msqdx-spacing-xl)` (16px 24px)
- **Header h3:** `font-size: var(--msqdx-font-size-lg); font-weight: 600; color: var(--color-text-primary); gap: var(--msqdx-spacing-sm)`
- **Icon-Container:** 2.5rem × 2.5rem, `border-radius: 12px`, Hintergrund z. B. `--color-secondary-dx-pink-tint`, Icon-Farbe passend
- **Toggle-Button:** `width/height: var(--msqdx-spacing-xxl)` (32px), `border-radius: 50%`, Hover: `--color-secondary-dx-orange-tint` / `--color-secondary-dx-orange`
- **Section:** `.msqdx-glass-dashboard-card-section` – `margin-bottom: 1.5rem` (letzte: 0)
- **Section h4:** `margin: 0 0 1rem 0; font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary)`

Varianten mit **border-top 3px** zur Kategorisierung:
- `.--bio` → `--color-theme-accent`
- `.--personality` → `--color-secondary-dx-yellow`
- `.--pain-goals` → `--color-secondary-dx-pink`
- `.--communication` → `--color-secondary-dx-blue`
- `.--knowledge` → `--color-secondary-dx-green`
- `.--advanced` → `--color-secondary-dx-orange`

### Dashboard-Card-Grid
- **Klasse:** `.msqdx-glass-dashboard-grid`
- **Grid:** `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--msqdx-spacing-xl); margin-top: var(--msqdx-spacing-xxl);`

### Molecule-Card (Admin-Dashboard – Projekte/Personas/Target Groups)
- Verwendung: `MsqdxMoleculeCard` mit `variant="flat"`, `borderRadius="button"`
- **Border:** `1px solid` + `var(--color-theme-accent)`
- **Abstand zwischen Karten:** `gap: 2` (MUI = 16px)
- **Responsive:** `gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }`
- **Liste in Card:** `Stack spacing={1.25}`, Item: `p: 1.25`, `borderRadius: 1`, `border: 1px solid divider`, Hover: `borderColor: accent`
- **Icon-Box (40×40):** `borderRadius: 1`, `bgcolor: "rgba(0,0,0,0.04)"`

### Settings-Card
- **Klasse:** `.msqdx-glass-settings-card`
- **Border:** `1px solid rgba(148, 163, 184, 0.3)`
- **Border-Radius:** **16px**
- **Padding:** `1.25rem`
- **Hover:** `border-color: var(--color-theme-accent); transform: translateY(-2px);`
- **Grid:** `.msqdx-glass-settings-grid` – `repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-top: 1.5rem;`

### Stat-Card (Queue-Dashboard, KPI-Karten)
- **Grid:** `.msqdx-glass-stats-grid` – `repeat(auto-fit, minmax(120px, 1fr)); gap: var(--msqdx-spacing-md);`
- **Karte:** `.msqdx-glass-stat-card`
- **Border:** `1px solid var(--color-secondary-dx-grey-light-tint)` (Dark: `rgba(255,255,255,0.1)`)
- **Border-Radius:** `var(--msqdx-radius-sm)` = **8px**
- **Padding:** `var(--msqdx-spacing-md) var(--msqdx-spacing-lg)` (16px 18px)
- **Label:** `.msqdx-glass-stat-card__label` – `0.75rem`, `uppercase`, `letter-spacing: 0.05em`, `color: var(--color-text-secondary)`
- **Wert:** `.msqdx-glass-stat-card__value` – `var(--msqdx-font-size-lg)`, `font-weight: 600`, `color: var(--color-text-primary)`

### List-Item (z. B. Queue, Sidebar)
- **Klasse:** `.msqdx-glass-list-item`
- **Border:** `1px solid rgba(15, 23, 42, 0.08)` (Dark: `rgba(255,255,255,0.1)`)
- **Border-Radius:** **6px**
- **Padding:** `0.5rem 0.75rem`
- **Background:** `#fff` (Dark: `rgba(255,255,255,0.03)`)
- **Aktiv:** `border-color: var(--color-theme-accent); background: rgba(182,56,255,0.05)` (Dark: 0.1)
- **Liste:** `.msqdx-glass-list` – `gap: 0.375rem; max-height: 500px; padding: 0 0.5rem 0 0.75rem`

---

## 5. Buttons & Links

### Primär-Button
- **Klasse:** `.msqdx-glass-button`
- **Border-Radius:** **999px** (pill)
- **Padding:** `0.5rem 1rem`
- **Font:** `font-weight: 600; font-size: 0.8125rem`
- **Background:** `#0f172a`, **Color:** `#fff`

### Ghost-Button
- **Klasse:** `.msqdx-glass-button.--ghost`
- **Background:** transparent
- **Border:** `1px solid rgba(15,23,42,0.15)` (Dark: `rgba(255,255,255,0.15)`)
- **Padding:** `0.375rem 0.75rem`, **Font-size:** `0.75rem`

### Admin-Link (Pill)
- **Klasse:** `.msqdx-glass-admin-link`
- **Padding:** `0.4rem 0.9rem`, **border-radius: 999px**
- **Background:** `#0f172a`, **Color:** `#fff`, **font-weight: 600**

---

## 6. Chips & Badges

### Chip Basis
- **Klasse:** `.msqdx-glass-chip`
- **Padding:** `0.1rem 0.75rem` (Basis); Dashboard-Varianten: `0.5rem 1rem` oder `0.35rem 0.75rem`
- **Border-Radius:** **999px** (Basis) oder **16px** / **20px** (Dashboard)
- **Font:** `0.75rem`, `font-weight: 600`, oft `text-transform: uppercase` (Dashboard: `none`)

### Dashboard-Chip-Varianten (mit .--dashboard)
- Default: `--color-secondary-dx-pink-tint` / `--color-secondary-dx-pink`, `border-radius: 20px`, `font-size: 0.875rem`
- **Trait/Value:** green tint/border, `0.75rem`
- **Interest:** yellow tint/border
- **Pain:** pink tint/border, `0.75rem`
- **Goal:** blue tint/border, `0.75rem`
- **Social:** orange tint/border
- **Vocab:** blue tint/border, `0.75rem`

### Status-Chips (Queue, etc.)
- **Pending:** `.msqdx-glass-chip.--pending` – grau
- **Processing:** `.--processing` – orange
- **Success:** `.--success` – grün
- **Error:** `.--error` – pink

### Status-Pill
- **Klasse:** `.msqdx-glass-status-pill`
- **Font:** `0.75rem`, `text-transform: uppercase`, `letter-spacing: 0.05em`
- **Padding:** `0.15rem 0.65rem`, **border-radius: 999px**, **border: 1px solid currentColor**
- **.--success** / **.--warning** – Farbe + dezenter Hintergrund

---

## 7. Formulare & Felder

### Field-Container
- **Klasse:** `.msqdx-glass-field`
- **Layout:** `flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.5rem`
- **Label:** `font-size: 0.6875rem; color: #475569; font-weight: 500`
- **Input/Select:** `border-radius: 6px; border: 1px solid var(--color-theme-accent); padding: 0.375rem 0.5rem; font-size: 0.75rem`

### Create-Form
- **Klasse:** `.msqdx-glass-create-form`
- **Border-Radius:** **8px**, **Border:** `1px solid var(--color-theme-accent)**
- **Padding:** `0.75rem`, **Margin:** `0 0.5rem 0.5rem 0.5rem`

---

## 8. Accordion

- **Klasse:** `.msqdx-glass-accordion`
- **Border:** `1px solid var(--color-secondary-dx-grey-light)`
- **Border-Radius:** **8px**
- **Header:** `padding: 1rem 1.25rem`
- **Content:** `padding: 1.25rem`, `border-top: 1px solid var(--color-secondary-dx-grey-light)`

---

## 9. Sonstige feste Werte

- **Avatar (Detail):** 72×72px, `border-radius: 18px`
- **Detail-Grid:** `repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem`
- **Meta-Grid:** `repeat(auto-fit, minmax(120px, 1fr)); gap: 0.5rem`
- **Toast:** `border-radius: 8px`, `padding: 16px 24px`, Animation `slideIn`/`slideOut` 0.3s
- **Scrollbar (Admin-Content):** `width: 8px`, Thumb `border-radius: 4px`

---

## 10. Dark Mode

- Alle Flächen und Texte über `[data-theme="dark"]` umschalten.
- Karten: Hintergrund `var(--color-background)` oder `rgba(255,255,255,0.05)`, Borders `rgba(255,255,255,0.1)`.
- Theme-Akzent beibehalten; Tints mit niedriger Opacity (z. B. 0.2) nutzen.

---

## 11. Responsive / Breakpoints

- **1200px:** Admin-Grid eine Spalte, Sidebar volle Breite.
- **960px:** Admin-Nav (Desktop) – position relative.
- **768px:** Journey-Timeline Header column, Viewport scroll-padding anpassen.
- **959px (Mobile):** Typography-Skala und Admin-Nav angepasst (siehe globals.css Media Queries).

---

## 12. Dashboard-Accordions (Standard: zugeklappt)

Für weniger visuelle Last starten **Metadaten-, Wissens- und Integrations-Karten** eingeklappt:

- **Persona-Detail** (`msqdx-glass-persona-admin-panel.tsx`): `metadata`, `knowledge-sources`, `integrations` sind nicht in der initialen `expandedAccordions`-Menge.
- **Zielgruppe-Detail** (`msqdx-glass-target-group-admin-panel.tsx`): `metadata`, `knowledge`, `knowledge-explorer` standardmäßig zu.
- **Projekt-Einstellungen** (`msqdx-glass-project-admin-panel.tsx`): Karte **Journey aus Projektwissen** (`generate-journey`) standardmäßig zu; übrige Sektionen unverändert.

---

## 13. Zentrale Referenz (Pfade)

- **Tokens/Globals:** `apps/web/styles/globals.css`
- **Dashboard-Karten:** `apps/web/styles/dashboard-cards.css`
- **Admin-Layout/Nav:** `apps/web/styles/admin.css`
- **Komponenten:** `apps/web/components/admin/`, `apps/web/components/dashboard-cards/`

Bei neuen Apps: Diese Regeln und Tokens wiederverwenden; Abstände und Radii ausschließlich über die genannten Variablen und Werte definieren, damit das Erscheinungsbild mit dem AUDION-Dashboard konsistent bleibt.
