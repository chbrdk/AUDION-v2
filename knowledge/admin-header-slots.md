# Admin header content slots

## Legacy frosted bar (most admin routes)

- **`useAdminHeader().setHeaderContent` / `headerContent`** — right cluster of the frosted bar (with Plexon link, replaces default page title when set). Used by e.g. admin chat.
- **`useAdminHeader().setHeaderStartContent` / `headerStartContent`** — **left** cluster, rendered **immediately after** `<AdminTopControls />` (legacy `MsqdxSelect` project field). Same visibility as project: hidden below MUI `md` (`900px`).

## Personas v2 card header (`/admin/personas-v2/*`)

On personas v2 routes, `MsqdxGlassAdminLayoutClient` switches to **`MsqdxGlassAdminHeaderV2Card`**:

- One **rounded bordered card** from logo inset (`--msqdx-admin-header-logo-inset`, 230px) to the content edge.
- **Start:** `MsqdxGlassAdminProjectPicker` (compact uppercase label + value) → optional divider → `headerStartContent` (e.g. back to list).
- **End:** Plexon link + `headerContent` or default page title (`MsqdxGlassAdminHeaderPageTitle` with section icon).
- Styles: `apps/web/styles/admin-header-v2.css` (imported in `app/admin/personas-v2/layout.tsx`).
- Layout tokens: `apps/web/lib/admin-header-layout.ts`.

Persona v2 detail still sets `headerStartContent` for “back to all personas” from `md` up; below `md` the same link stays in the **black entity hero** (`backHref` on `MsqdxGlassSectionShell`).

Clear slots on route unmount (`useEffect` cleanup) to avoid leaking UI across navigations.
