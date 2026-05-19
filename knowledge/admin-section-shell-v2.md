# Admin Section Shell v2

## Problem (v1)

- **Global sidebar** (`MsqdxAdminNav`): app-wide routes only.
- **Detail pages** (personas, target groups): one long scroll of `MsqdxDashboardCard` accordions (~3k lines for personas).
- **`.msqdx-glass-admin-grid`**: legacy list sidebar + main; detail mode drops the list and uses full width — still no section navigation.
- **Result**: cramped grids, cognitive overload, weak focus per task.

## Zielbild (v2)

Drei Zonen von links nach rechts:

```
┌─────────────┬──────────────────┬────────────────────────────────────┐
│ App-Nav     │ Section-Subnav   │ Section Workspace                  │
│ (bestehend) │ (Karten-Rail)    │ (ein Bereich, viel Whitespace)     │
│ MsqdxAdmin  │ MsqdxGlass       │ Header: Entity + Aktionen          │
│ Nav         │ SectionNav       │ Body: eine Sektion / eine Aufgabe   │
└─────────────┴──────────────────┴────────────────────────────────────┘
```

### Prinzipien

1. **Eine Sektion pro Route** — URL = mentales Modell (`/admin/personas-v2/{id}/moodboard`).
2. **Subnav als Karten** — nicht nur Textlinks; Icon, Titel, Kurzbeschreibung, aktiver Zustand.
3. **Mehr Luft** — Subnav ~240–280px; Content `max-width` + großzügiges Padding; kein `auto-fit` 320px-Accordion-Grid auf der Detailseite.
4. **Wiederverwendbar** — `MsqdxGlassSectionShell` + `SectionNavItem[]`; Domain definiert Sektionen (`persona-v2-sections.ts`, später `target-group-v2-sections.ts`).
5. **Parallel-Rollout** — v1 bleibt; v2 unter `/admin/personas-v2` (und später analoge Pfade).

## Komponenten (Audion `apps/web`)

| Piece | Path |
|-------|------|
| Shell | `components/admin/section-shell/msqdx-glass-section-shell.tsx` |
| Entity header | `entityCornerAccent`: Text **hell** (`--msqdx-entity-accent-on-surface*`), **rechtsbündig** in schwarzer `MsqdxCornerBox`; 36px Radius. On-surface-Regeln nutzen **höhere Spezifität + `!important`**, weil `monochrome-theme.css` für `.msqdx-glass-admin-content h1|p|span` ebenfalls `!important` setzt und sonst dunkle Schrift auf dem schwarzen Hero erzwingt. |
| Subnav | `components/admin/section-shell/msqdx-glass-section-nav.tsx` |
| Styles | `styles/section-shell.css` |
| Persona sections | `lib/persona-v2-sections.ts` |
| Test UI | `app/admin/personas-v2/**` |

## Persona-Sektionen (v2)

| Section ID | v1 Accordion | Hinweis |
|------------|--------------|---------|
| `overview` | — | Hub: Kurzinfo, Links zu Bereichen |
| `basics` | persona-basics | Name, Avatar, Headline, Chat-Prompt |
| `bio` | bio/demographics | Biografie & Demografie |
| `personality` | personality | Traits, Interessen, Werte |
| `communication` | communication | Stil, Vokabular |
| `pain-goals` | pain/goals | Schmerzpunkte & Ziele |
| `knowledge` | knowledge | Dokumente, Quellen |
| `ux-history` | ux journey | UX-Runs, Journey-Konvertierung |
| `moodboard` | moodboard | Tiles, Generierung |
| `advanced` | advanced | JSON, Palette, Expertenfelder |

Migration: Sektionen schrittweise aus `msqdx-glass-persona-admin-panel.tsx` extrahieren; v2-Platzhalter bis dahin mit Link „In v1 bearbeiten“.

## Wiederverwendung auf anderen Admin-Seiten

| Bereich | Overview | Detail + Subnav |
|---------|----------|-----------------|
| Personas | `/admin/personas-v2` | `/admin/personas-v2/[id]/[section]` |
| Target Groups | `/admin/target-groups-v2` (geplant) | analog |
| Journeys | `/admin/journeys-v2` (geplant) | analog |
| Projects | optional Subnav: Prompts, Settings, … | |

## Responsive

| Breakpoint | Layout |
|------------|--------|
| **≥ 1025px** | Zwei Spalten: **kompakte Subnav** (~224px, Icon + Label, Beschreibung per `title`-Tooltip, sticky + `max-height: 100dvh - 112px`), **rechts** Entity + `workspace__main`. |
| **≤ 1024px** | 1. horizontale Subnav-Chips, 2. Content-Spalte mit Entity-Header, Section-Titel, Inhalt. |

Entity-Header sitzt immer in `.msqdx-glass-section-workspace` direkt über `.msqdx-glass-section-workspace__main` — nie über die volle Admin-Breite.

## Mobile

- Subnav: horizontale scrollbare Chips **zuerst** (ohne Beschreibungstext).
- Entity-Header: Teil der Content-Spalte, nicht mehr über der gesamten Admin-Fläche.
- Section-Panel-Toggle optional über bestehenden `AdminPanelProvider`.

## Referenzen

- Design tokens: `knowledge/audion-dashboard-design-rules.md`
- Routing v1: `knowledge/personas-target-groups-routing.md`
- DS: `MsqdxCollapsiblePanel`, `MsqdxMoleculeCard`, `MsqdxAppLayout`
