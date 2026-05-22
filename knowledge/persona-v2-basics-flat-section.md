# Persona v2 — flat basics section

## Pattern

- **Workspace header**: `MsqdxGlassSectionShell` receives `sectionTitle` / `sectionDescription` from `getPersonaV2SectionDef()` (all sections except `overview`).
- **Basics content**: `msqdx-glass-persona-basics-section` + `msqdx-glass-persona-basics-stack` in `msqdx-glass-persona-admin-panel.tsx` — no `MsqdxDashboardCard` in v2.
- **Blocks**: `PersonaAdminSectionSurface` with `embedInSection={isV2Section}` wraps profile (no block title), metadata, integrations.
- **Separators**: `MsqdxGlassPainGoalsSectorSeparator` between blocks (same as pain/personality stacks).

## Components

| File | Role |
|------|------|
| `apps/web/components/personas-v2/persona-v2-section-block.tsx` | Mono h3 block heading + article |
| `apps/web/components/personas-v2/persona-admin-section-surface.tsx` | Card (v1) vs flat block (v2) switch |
| `apps/web/styles/persona-v2-section-panel.css` | Basics layout + tokenized grid gap |

## Reuse for other sections

Apply `PersonaAdminSectionSurface` + `embedInSection` to bio, communication, knowledge, etc. (see pain-goals / personality cards).
