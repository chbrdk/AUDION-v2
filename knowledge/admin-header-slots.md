# Admin header content slots

- **`useAdminHeader().setHeaderContent` / `headerContent`** — right cluster of the frosted bar (with Plexon link, replaces default page title when set). Used by e.g. admin chat.
- **`useAdminHeader().setHeaderStartContent` / `headerStartContent`** — **left** cluster, rendered **immediately after** `<AdminTopControls />` (project selector). Same visibility as project: hidden below MUI `md` (`900px`). Used by Persona v2 detail for “back to all personas” beside the project field.

Clear slots on route unmount (`useEffect` cleanup) to avoid leaking UI across navigations.
