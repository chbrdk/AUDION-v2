# AUDION Design System Refactoring (Feb 8, 2025)

## Summary
AUDION has been refactored to use components and tokens from the msqdx-design-system. This document captures what was done and important details for future work.

## Completed Phases

### Phase 1: Dependencies
- Added `@msqdx/react` and `@msqdx/tokens` as `file:../../../msqdx-design-system/packages/...` in `apps/web/package.json`
- Added both to `optimizePackageImports` in `next.config.mjs`

### Phase 2: Component Replacements
- **PersonaCard, TargetGroupCard, UploadDropzone, ProcessingTimeline**: Replaced with DS components via wrappers
- **MsqdxAdminNav**: Replaced `MsqdxGlassAdminNav` with DS `MsqdxAdminNav`; routing in `ADMIN_NAV_ITEMS` array
- **MsqdxCollapsiblePanel**: Thin wrapper around DS `MsqdxCollapsiblePanel` that wires `useAdminPanel()` context for mobile off-canvas

### Icon Migration (MaterialSymbol → MsqdxIcon)
- All `MaterialSymbol` imports replaced with `MsqdxIcon` from `@msqdx/react`
- Props: `icon=` → `name=`, `fontSize=` → `customSize=` for MsqdxIcon
- **Exception**: `MsqdxGlassEditButton` and `MsqdxGlassAiButtonIcon` use `fontSize`, not `customSize`
- Removed `components/material-symbol.tsx` after migration

### Phase 3: Token Compliance
- Added MSQDX token CSS variables in `globals.css` (`--msqdx-radius-*`, `--msqdx-spacing-*`, etc.)
- Updated `dashboard-cards.css` to use these variables instead of hardcoded values

## Design System Additions
- **AdminNavItem.exact**: Added `exact?: boolean` to DS `AdminNavItem` for Dashboard (path `/admin`) to only highlight on exact match

## Link Component
- Next.js `Link` passed to `MsqdxAdminNav` via `linkComponent={Link as any}` to satisfy type compatibility

## Paths
- Design system: `msqdx-design-system/packages/react`, `msqdx-design-system/packages/tokens`
- AUDION web: `AUDION/apps/web/`

## TDZ / Circular Import Fix (Cannot access 'i' before initialization)
- **Issue**: Runtime error `ReferenceError: Cannot access 'i' before initialization` when loading admin layout with @msqdx/react in the same chunk (likely circular dependency / temporal dead zone in minified code).
- **Fix**: Split admin layout to avoid synchronous import of @msqdx/react at layout load:
  1. Created `admin-layout-providers.tsx` – lightweight providers (AdminHeaderProvider, AdminPanelProvider, useAdminHeader, useAdminPanel) with no @msqdx/react
  2. Admin layout (`app/admin/layout.tsx`) statically imports providers from `admin-layout-providers`, and uses `next/dynamic` with `ssr: false` to load `MsqdxGlassAdminLayoutClient` from `msqdx-glass-admin-layout`
  3. `msqdx-glass-admin-layout.tsx` imports from `admin-layout-providers` and re-exports useAdminHeader/useAdminPanel for existing consumers

## Docker/CI Build
- AUDION uses `file:../../../msqdx-design-system/packages/*` for @msqdx/react and @msqdx/tokens
- The Dockerfile clones and builds the design system from GitHub before `npm install`, since the design system is not in the AUDION repo

## Remaining Opportunities
- Replace remaining `msqdx-glass-button --ghost` with `MsqdxButton variant="text"` across journey page and other components
- Replace MUI Typography/Box with MsqdxTypography/MsqdxCard where feasible
- Replace MsqdxGlassDashboardCard with DS MsqdxDashboardCard (requires structural changes for MsqdxDashboardCardSection)
- Add more token variables for remaining hardcoded values in components
