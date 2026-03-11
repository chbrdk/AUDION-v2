# AUDION Dark Theme

## Overview

Dark mode is toggled via Profile/Settings (theme mode: Light/Dark). The active mode is stored in `localStorage` under `audion-theme-mode` and applied as `data-theme="dark"` on `<html>`.

## CSS Variables (Dark)

Defined in `apps/web/styles/globals.css` under `[data-theme="dark"]`:

- `--audion-light-html-background-color: #0f0f0f` – page/content background
- `--color-primary-white: #1a1a1a` – card/surface background (replaces white)
- `--color-background: #1a1a1a` – used by dashboard cards
- `--color-neutral: #0f0f0f` – neutral background

## Key Overrides

- **html / body**: background `#0f0f0f`, text `#ffffff`
- **main, .msqdx-glass-admin-content, .msqdx-glass-panel, .msqdx-glass-detail, .msqdx-glass-admin-page**: background `#0f0f0f`
- **MUI Paper/Card, .msqdx-card**: background `var(--color-primary-white)` (#1a1a1a), text white
- **Dashboard cards**: `dashboard-cards.css` uses `--color-background` for `.msqdx-dashboard-card`
- **Settings cards**: `.msqdx-glass-settings-card` – background #1a1a1a, border rgba(255,255,255,0.15)
- **List items, stat cards, accordions**: existing dark overrides use rgba(255,255,255,0.03–0.1) or #1a1a1a

- **Profile / Identity panel** (`.msqdx-glass-panel`): Card containers (Stack children) use background `#1a1a1a`; all text, labels, inputs, textareas, selects are forced to white/dark in `globals.css` so the Identity and other profile cards are fully dark with white fonts.

- **Journeys** (`.msqdx-glass-journeys-overview`, `.msqdx-glass-journeys-grid`): List/grid of journey cards (and "Create" card) get dark background and light text via `.msqdx-glass-journeys-grid > *` and typography/chip overrides under `.msqdx-glass-journeys-overview`. Journey timeline (`.msqdx-glass-journey-timeline__*`) and phase cards (`.msqdx-glass-journey-phase`, `.msqdx-glass-journey-phase__*`) have dark overrides for header, steps, form fields, sections, and chips in `globals.css`.

- **Journey editor page** (`.msqdx-glass-journey-editor-page`): The journey detail/editor page (header card, metadata accordion, phases section, timeline viewport, phase cards, create-phase form, add-phase card) is fully dark-themed. The timeline viewport has class `.msqdx-glass-journey-timeline-viewport` (dark background, light scrollbar). All cards, typography, buttons, inputs, textareas, selects, chips, dividers, and dashboard cards inside `.msqdx-glass-detail` are overridden for dark mode in `globals.css`.

## Adding New Dark-Aware Components

1. Prefer CSS variables: use `var(--color-primary-white)` or `var(--color-neutral)` for backgrounds so they follow the theme.
2. For one-off components, add `[data-theme="dark"] .your-class { background-color: #1a1a1a; color: #ffffff; }` in `globals.css` or the relevant stylesheet.
3. MUI components inside `main` / `.msqdx-glass-admin-content` are overridden globally for Paper/Card; for other MUI components add specific dark rules if needed.
