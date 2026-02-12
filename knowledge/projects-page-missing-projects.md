# Projects-Seite: Projekte fehlen in der Liste (Admin)

## Symptome

- Auf `/admin/projects` werden links **keine bestehenden Projekte** angezeigt.
- Es erscheint nur die Möglichkeit, ein neues Projekt anzulegen.

## Ursache

- Die Server-Komponente `apps/web/app/admin/settings/projects/page.tsx` hat die Projektliste via `fetch(buildApiUrl("/api/projects"))` geladen.
- `buildApiUrl()` liefert eine **relative URL** (z. B. `/api/projects`). Auf dem Server kann das je nach Runtime/Proxy-Kontext fehlschlagen und wird dann als `[]` geschluckt (try/catch) → `initialProjects` bleibt leer.
- Zusätzlich hat `MsqdxGlassProjectAdminPanel` die UI-Liste nur aus `initialProjects` befüllt und nicht aus den live geladenen Projekten des `ProjectProvider`.

## Fix

1. **Server-Fetch auf internes Persona-Backend umstellen**
   - `apps/web/app/admin/settings/projects/page.tsx`
   - Statt Next-Proxy relativ: direkt `getPersonaBackendBase({ preferPublic: false }) + "/projects"` fetchen.

2. **Panel-Liste aus `ProjectProvider.projects` synchronisieren**
   - `apps/web/components/msqdx-glass-project-admin-panel.tsx`
   - Wenn `providerProjects` da sind, diese priorisieren; ansonsten `initialProjects` nutzen.

## Test

- Playwright E2E-Test stubbt `/api/projects` und prüft, dass ein Projektname auf `/admin/projects` sichtbar ist:
  - `tests/e2e/test_admin_workflows.spec.ts`

