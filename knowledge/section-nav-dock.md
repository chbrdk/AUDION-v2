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

**Active compact row:** `MsqdxCornerBox.msqdx-glass-section-nav__card-active-shell` — same right-edge `cutdown-b` corners + `24px` radius as the rail; fill `--msqdx-section-nav-active-card-surface` (white in light, soft highlight in dark). Inner `<Link>` stays transparent so the white shows from the shell.

Workspace: `.msqdx-glass-section-workspace--with-subnav` — `border: 1px solid var(--msqdx-section-nav-dock-border)`, `border-radius: 0 var(--msqdx-section-workspace-frame-radius) …` (token on `.msqdx-glass-section-shell`, default `36px`; top-left `0` where the frame meets the nav column). Inner `__dock-shell` transparent, no second border. Nav rail keeps tint fill (`--msqdx-section-nav-dock-surface`).

## Code

- Layout constants: `apps/web/lib/section-nav-dock-layout.ts`
- Component: `apps/web/components/admin/section-shell/msqdx-glass-section-nav.tsx`
- CSS: `apps/web/styles/section-shell.css` (`.msqdx-glass-section-nav--docked`, gap `0` on shell body)

## Workspace (right column)

| Corner | Style | Role |
|--------|--------|------|
| top-left | square (`0`) | Flush seam with the docked nav column |
| top-right, bottom-right, bottom-left | `rounded` (`36px`) | Pill-like frame around entity + section content |

Outer frame: `border-radius: 0 var(--msqdx-section-workspace-frame-radius) …` on `--with-subnav` (shell token, `36px` default); `SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX` for inner `MsqdxCornerBox` corners.

## Follow-ups (optional)

- Swap `cutdown-a` / `cutdown-b` per edge if the curve direction looks inverted
- On mobile (stacked layout), use all-`rounded` corners on the workspace dock
