# Persona v2 — flat basics section (Profil, Bio, Demografie, Metadaten)

## Pattern

- **Single nav section `basics`** — biography & demographics merged here; legacy route `/bio` redirects to `/basics` (`resolvePersonaV2SectionId` in `persona-v2-sections.ts`).
- **Workspace header**: `MsqdxGlassSectionShell` receives `sectionTitle` / `sectionDescription` from `getPersonaV2SectionDef()` (all sections except `overview`).
- **Basics content**: `msqdx-glass-persona-basics-section` + `msqdx-glass-persona-basics-stack` in `msqdx-glass-persona-admin-panel.tsx` — no `MsqdxDashboardCard` in v2.
- **Block order (v2)**: profile hero → biography → demographics → metadata → integrations.
- **Blocks**: `PersonaAdminSectionSurface` with `embedInSection={isV2Section}` wraps profile (no block title), metadata, integrations; `MsqdxGlassBioCardEdit` with `embedInParentStack` for bio blocks inside the same stack.
- **Separators**: `MsqdxGlassPainGoalsSectorSeparator` between blocks (same as pain/personality stacks).

## Components

| File | Role |
|------|------|
| `apps/web/components/personas-v2/persona-v2-section-block.tsx` | Mono h3 block heading + article |
| `apps/web/components/personas-v2/persona-admin-section-surface.tsx` | Card (v1) vs flat block (v2) switch |
| `apps/web/styles/persona-v2-section-panel.css` | Basics layout + tokenized grid gap |

## Bio inside basics (v2)

- `MsqdxGlassBioCardEdit` with `embedInSection` + `embedInParentStack` — biography + demographics blocks only (no outer `msqdx-glass-bio-section` wrapper).
- v1 full panel: bio still renders as its own accordion card after the basics cards.

## Reuse for other sections

Apply `PersonaAdminSectionSurface` or `embedInSection` to communication, knowledge, etc. (see pain-goals / personality cards).
