# Admin header content slots

- **`useAdminHeader().setHeaderContent` / `headerContent`** — right cluster of the frosted bar (with Plexon link, replaces default page title when set). Used by e.g. admin chat.
- **`useAdminHeader().setHeaderStartContent` / `headerStartContent`** — **left** cluster, rendered **immediately after** `<AdminTopControls />` (project selector). Same visibility as project: hidden below MUI `md` (`900px`). Persona v2 detail uses this for “back to all personas” from `md` up; below `md` the same link stays available **in the black entity hero** (`backHref` on `MsqdxGlassSectionShell`), and CSS hides that in-page row from `md` so the header control is the only one.

Clear slots on route unmount (`useEffect` cleanup) to avoid leaking UI across navigations.
