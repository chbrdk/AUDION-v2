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

## Adding New Dark-Aware Components

1. Prefer CSS variables: use `var(--color-primary-white)` or `var(--color-neutral)` for backgrounds so they follow the theme.
2. For one-off components, add `[data-theme="dark"] .your-class { background-color: #1a1a1a; color: #ffffff; }` in `globals.css` or the relevant stylesheet.
3. MUI components inside `main` / `.msqdx-glass-admin-content` are overridden globally for Paper/Card; for other MUI components add specific dark rules if needed.
