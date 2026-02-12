# Projects Routing (Admin)

## Ziel

- `/admin/projects` = **Übersichtsseite** (alle Projekte als Cards nebeneinander)
- `/admin/projects/[projectId]` = **Detailseite** für ein Projekt (Details rechts wie vorher)
- `/admin/settings/projects` = Redirect → `/admin/projects`

## Umsetzung

- **Overview**
  - Route: `apps/web/app/admin/projects/page.tsx`
  - UI: `apps/web/components/projects/msqdx-glass-projects-overview.tsx`
  - Daten:
    - SSR: lädt initiale Projekte via Persona-Backend `/projects`
    - Client: nutzt zusätzlich `ProjectProvider.projects` (live)
  - Create:
    - Inline „Create Project“-Card (Form) nutzt `useProject().createProject()`

- **Detail**
  - Route: `apps/web/app/admin/projects/[projectId]/page.tsx`
  - UI: bestehendes Panel `MsqdxGlassProjectAdminPanel` in `mode="detail"`
  - Verhalten:
    - Versteckt die Projekt-Liste links
    - Erzwingt `selectProject(projectId)` (Cookie/Provider Sync)

## Test

- Playwright: `tests/e2e/test_admin_workflows.spec.ts`
  - Stub `/api/projects` → Overview zeigt Projekt
  - Klick auf Card → navigiert auf `/admin/projects/{id}`

