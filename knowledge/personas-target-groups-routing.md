# Personas & Target Groups — Overview/Detail Routing

## Goal
We mirror the **Projects** routing pattern:
- **Overview** pages show all entities as cards.
- **Detail** pages show the full editor/detail UI for a single entity.

## Routes

### Personas
- **Overview**: `/admin/personas`
- **Detail**: `/admin/personas/[personaId]`

### Target Groups
- **Overview**: `/admin/target-groups`
- **Detail**: `/admin/target-groups/[targetGroupId]`

## Central route constants (no hardcoding)
Use:
- `apps/web/lib/routes.ts` (`ADMIN_ROUTES`)

Example:
- `ADMIN_ROUTES.personas`
- `ADMIN_ROUTES.personaDetail(personaId)`
- `ADMIN_ROUTES.targetGroups`
- `ADMIN_ROUTES.targetGroupDetail(targetGroupId)`

## Implementation notes
- Overview UIs are MSQDX design-system based and implemented as:
  - `apps/web/components/personas/msqdx-glass-personas-overview.tsx`
  - `apps/web/components/target-groups/msqdx-glass-target-groups-overview.tsx`
- **`MsqdxMoleculeCard` (`MsqdxCard`) slots:** `subtitle` is **`string` only** (rendered as `MsqdxTypography` body2). Chip rows, tooltips, and other rich UI must use **`chips?: ReactNode`** and/or **`children`**. See `apps/web/lib/msqdx-molecule-card-props.test.ts` for the typed contract.
- Detail pages reuse the existing admin panels in **detail mode**:
  - `MsqdxGlassPersonaAdminPanel` supports `mode="detail"` + `activePersonaId`
  - `MsqdxGlassTargetGroupAdminPanel` supports `mode="detail"` + `activeTargetGroupId`
- In `mode="detail"`:
  - the left list panel is hidden
  - the detail panel spans full width

