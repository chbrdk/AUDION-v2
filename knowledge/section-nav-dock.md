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

Workspace: `MsqdxCornerBox.msqdx-glass-section-workspace__dock-shell` — transparent fill, `border: 4px solid var(--msqdx-section-workspace-dock-border)` (fallback `rgba(0,0,0,0.09)`), radius `42px` (`SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX`), all corners `rounded`. Nav rail keeps the light tint fill (`--msqdx-section-nav-dock-surface`).

## Code

- Layout constants: `apps/web/lib/section-nav-dock-layout.ts`
- Component: `apps/web/components/admin/section-shell/msqdx-glass-section-nav.tsx`
- CSS: `apps/web/styles/section-shell.css` (`.msqdx-glass-section-nav--docked`, gap `0` on shell body)

## Workspace (right column)

| Corner | Style | Role |
|--------|--------|------|
| all four | `rounded` | Pill-like frame around entity + section content |

Radius `42px`; border via `--msqdx-section-workspace-dock-border`. Implemented in `msqdx-glass-section-shell.tsx` (`msqdx-glass-section-workspace__dock-shell`).

## Follow-ups (optional)

- Swap `cutdown-a` / `cutdown-b` per edge if the curve direction looks inverted
- On mobile (stacked layout), use all-`rounded` corners on the workspace dock
