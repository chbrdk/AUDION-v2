# Section subnav dock (cutout corners)

## Intent

Desktop compact subnav (`msqdx-glass-section-nav--compact`) sits in a `MsqdxCornerBox` shell so the rail **appears glued to the workspace** on the right — same geometry family as pain/goals `MsqdxCornerTabCard`.

## Corners (left rail)

| Corner | Style | Role |
|--------|--------|------|
| top-left, bottom-left | `rounded` | Outer edge of the admin layout |
| top-right, bottom-right | `cutdown-b` | Concave on the right edge (oben/unten rechts, not rechts oben/unten) |

Radius: `24px` (`SECTION_NAV_DOCK_BORDER_RADIUS_PX` / `--msqdx-radius-3xl`).

Surface: `--msqdx-section-nav-dock-surface` → `--color-theme-accent-tint` (light rail, not solid white). Docked nav uses `overflow: visible` / `max-height: none` so cutout patches do not trigger a scrollbar.

**Active compact row:** `MsqdxCornerBox.msqdx-glass-section-nav__card-active-shell` — same right-edge `cutdown-b` corners + `24px` radius as the rail. Tokens: `--msqdx-section-nav-active-card-surface` (`#000000`, opaque) and `--msqdx-section-nav-active-card-on-surface` (`#ffffff`) for label + icon; cutout patches inherit the surface fill. Inner `<Link>` stays transparent. Dock shell uses `pl: theme.spacing(0.75)` and **`pr: 0`** so the active strip meets the inner right edge of the rail.

Workspace: `.msqdx-glass-section-workspace--with-subnav` — `border: 1px solid var(--msqdx-section-workspace-frame-border)` where the token resolves to `var(--color-theme-accent)` (opaque: black on light surfaces, white on dark/monochrome-dark content). `border-radius` uses `--msqdx-section-workspace-frame-radius` on **all four corners**. Inner `__dock-shell` transparent, no second border. Nav rail keeps tint fill (`--msqdx-section-nav-dock-surface`) and subtle separators (`--msqdx-section-nav-dock-border`).

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
- On mobile (stacked layout), use all-`rounded` corners on the workspace dock
