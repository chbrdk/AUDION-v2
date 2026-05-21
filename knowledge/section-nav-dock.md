# Section subnav dock (cutout corners)

## Intent

Desktop compact subnav (`msqdx-glass-section-nav--compact`) sits in a `MsqdxCornerBox` shell so the rail **appears glued to the workspace** on the right — same geometry family as pain/goals `MsqdxCornerTabCard`.

## Corners (left rail)

| Corner | Style | Role |
|--------|--------|------|
| top-left, bottom-left | `rounded` | Outer edge of the admin layout |
| top-right, bottom-right | `cutdown-b` | Concave on the right edge (oben/unten rechts, not rechts oben/unten) |

Radius: `24px` (`SECTION_NAV_DOCK_BORDER_RADIUS_PX` / `--msqdx-radius-3xl`).

Dock shell (`__dock-shell`): `background: unset` — no tint fill on the rail frame (active row still uses opaque black). Docked nav uses `overflow: visible` / `max-height: none` so cutout patches do not trigger a scrollbar.

**Active compact row (desktop ≥1025px):** `MsqdxCornerBox.msqdx-glass-section-nav__card-active-shell` — same right-edge `cutdown-b` corners + `24px` radius as the rail. Tokens: `--msqdx-section-nav-active-card-surface` (`#000000`, opaque) and `--msqdx-section-nav-active-card-on-surface` (`#ffffff`) for label + icon; cutout patches inherit the surface fill. Inner `<Link>` stays transparent. Dock shell uses `pl: theme.spacing(0.75)` and **`pr: 0`** so the active strip meets the inner right edge of the rail.

**Horizontal (≤1024px):** Entity corner hero (`entityCornerAccent`) renders **above** the horizontal subnav (`entityStackedAboveNav` / `__entity--stacked-above-nav`), not inside the workspace frame. Responsive corners: all corners rounded at 36px (`SECTION_ENTITY_CORNER_ACCENT_CORNERS_RESPONSIVE`). `msqdx-glass-section-nav--horizontal` — `<nav>` and `__dock-shell` use `--msqdx-section-nav-horizontal-dock-border-radius` (36px, same as workspace frame) on **all four corners**; `MsqdxCornerBox` uses `SECTION_NAV_HORIZONTAL_DOCK_BORDER_RADIUS_PX` + `SECTION_NAV_HORIZONTAL_DOCK_CORNER_STYLES` (all `rounded`). Inner tab links use `border-radius: 0` so the rail silhouette stays clean. `margin-bottom: 0` (no workspace overlap pull; `SECTION_NAV_HORIZONTAL_WORKSPACE_OVERLAP_PX` is `0`). `__dock-track` uses `padding-block: 0` and `py: 0` in horizontal mode (no extra vertical inset on the scroll rail). `__dock-track` scrolls horizontally (`overflow-x: auto`, `overflow-y: visible`, `scroll-snap-type: x`); scrollbar hidden on ≤1024px (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) — swipe/touch scroll still works. Active tab uses `SECTION_NAV_HORIZONTAL_ACTIVE_CORNER_STYLES` (all four corners `cutdown-a`: top side-edge patches into the rail, bottom into the workspace below). Dock shell / active shell use `overflow: visible` so cutout patches are not clipped. Active section scrolls into view via `scrollIntoView({ inline: "center" })`.

Workspace: `.msqdx-glass-section-workspace--with-subnav` — `border: var(--msqdx-section-workspace-frame-border-width) solid var(--msqdx-section-workspace-frame-border)` where width is `var(--msqdx-spacing-xxs)` (4px) and color resolves to `var(--color-theme-accent)` (opaque: black on light surfaces, white on dark/monochrome-dark content). `border-radius` uses `--msqdx-section-workspace-frame-radius` (36px) on **all four corners** at every breakpoint (horizontal layout does not flatten the top edge). Inner workspace `__dock-shell` transparent, no second border.

## Code

- Layout constants: `apps/web/lib/section-nav-dock-layout.ts`
- Component: `apps/web/components/admin/section-shell/msqdx-glass-section-nav.tsx`
- CSS: `apps/web/styles/section-shell.css` (`.msqdx-glass-section-nav--docked`, gap `0` on shell body)

## Workspace (right column)

| Corner | Style | Role |
|--------|--------|------|
| all four | `rounded` (`36px` via `--msqdx-section-workspace-frame-radius`) | Pill-like frame around entity + section content |

Outer frame: four-corner `border-radius` from `--msqdx-section-workspace-frame-radius` on `--with-subnav`; `SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX` for inner `MsqdxCornerBox` corners.

## Follow-ups (optional)

- Swap `cutdown-a` / `cutdown-b` per edge if the curve direction looks inverted
- Tune horizontal tab min-width / snap alignment if labels truncate awkwardly
