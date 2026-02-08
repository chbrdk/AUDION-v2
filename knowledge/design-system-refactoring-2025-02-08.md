# AUDION Design System Refactoring (Feb 8, 2025)

## Konvention: Theme Provider
**Bei Theme-Provider-Problemen entscheiden wir uns konsequent dafür, wie es im Design System definiert ist.** Keine eigenen ThemeProvider-/ThemeRegistry-Abweichungen – die DS-Definition hat Vorrang.

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
- **MsqdxGlassEditButton** and **MsqdxGlassAiButtonIcon** now use DS `MsqdxButton` (fontSize → customSize for MsqdxIcon)
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
- **Issue**: Runtime error `ReferenceError: Cannot access 'i' before initialization` when loading @msqdx/react (chunk 8505). Causes: (1) optimizePackageImports rewriting DS barrel imports, (2) admin layout loading @msqdx/react synchronously.
- **Fixes applied**:
  1. **next.config.mjs**: Remove `@msqdx/react` from `optimizePackageImports` – the optimization can trigger TDZ when rewriting the DS barrel.
  2. **admin-layout-providers.tsx**: Lightweight providers without @msqdx/react; admin layout uses `next/dynamic` for `MsqdxGlassAdminLayoutClient`.

## Docker/CI Build
- AUDION uses `file:../../../msqdx-design-system/packages/*` for @msqdx/react and @msqdx/tokens
- The Dockerfile clones and builds the design system from GitHub before `npm install`, since the design system is not in the AUDION repo

## Persona Listing & Create (Feb 2025)
- **Persona admin panel**: List items use `MsqdxCard` (clickable, flat), create form uses `MsqdxFormField` + `MsqdxButton`. Replaced `msqdx-glass-list`, `msqdx-glass-list-item`, `msqdx-glass-field`, `msqdx-glass-create-form`.
- **MsqdxGlassPersonaList**: Uses `MsqdxCard`, `MsqdxChip`, `MsqdxButton`, `MsqdxTypography`; status chips use DS brandColor.
- **MsqdxGlassPersonaCreateDialog**: Uses `MsqdxDialog`, `MsqdxFormField`, `MsqdxTextareaField`, `MsqdxButton` instead of custom modal and `msqdx-glass-field`.

## Metadata Section → MsqdxDashboardCard (Feb 2025)
- **Persona admin panel**: Metadata box (`msqdx-glass-detail__grid`, `msqdx-glass-meta-grid`) replaced with DS `MsqdxDashboardCard`.
- Metadata card is the first card in the dashboard grid; uses accordion ID `metadata`, icon `info`, brandColor `black`, iconColor `var(--color-theme-accent)`.
- Label/value pairs use `MsqdxTypography` (caption + body2); grid layout via MUI `Box` with `borderLeft` for visual separation.
- "metadata" added to initial `expandedAccordions` set.

## Dashboard Cards & Buttons → DS (Feb 2025)
- **MsqdxGlassDashboardCard** → **MsqdxDashboardCard** in all dashboard cards (personality, pain-points-goals, communication, knowledge-sources, advanced, bio, bio-edit, persona-basics, admin panel bio card).
- **MsqdxGlassAiButtonIcon** → **MsqdxButton** (variant="outlined", brandColor="purple", icon-only).
- **MsqdxGlassEditButton** → **MsqdxButton** (variant="outlined", brandColor="purple", icon-only).
- **MsqdxGlassDashboardCardSection** → uses **MsqdxTypography** for section titles.
- **Chip editor** IconButtons (close, add) → **MsqdxButton** (variant="text").
- **Knowledge card** buttons (Upload, Download, Retry, Delete, Add knowledge) → **MsqdxButton**.
- **Persona basics** Archive/Delete → **MsqdxButton**.
- fullWidth cards wrapped in `Box sx={{ gridColumn: "1 / -1" }}`.

## MsqdxGlassFieldEditor Select → MsqdxSelect (Feb 2025)
- **MsqdxGlassFieldEditor**: Replaced MUI `Select`/`FormControl`/`MenuItem` with DS `MsqdxSelect` for `field.type === "select"`.
- Affects Gender, Status, and any other select fields rendered via `MsqdxGlassEntityEditor` (persona Demographics, target group, etc.).
- Options include empty `{ value: "", label: "—" }` for nullable fields.
- In inline mode, label is passed as `""` to avoid duplicate with EntityEditor's column label.

## Chip Editor, Persona Basics, Target Group, Chat → DS Inputs (Feb 2025)
- **MsqdxGlassChipEditor**: Replaced MUI TextField with DS `MsqdxInput` for inline chip edit and "Neuen Eintrag hinzufügen" (Pain Points, Goals, Interests, Values, Traits, Social Media).
- **MsqdxGlassPersonaBasicsCard**: Replaced raw `<input>` with `MsqdxFormField` for Name, Segment, Headline, Updated by.
- **MsqdxGlassTargetGroupAdminPanel**: Replaced raw inputs/textareas with `MsqdxFormField` and `MsqdxTextareaField` for create forms (Target Group, Persona, Knowledge).
- **MsqdxGlassChatItem**: Replaced MUI TextField with `MsqdxInput` for inline title edit.

## MsqdxGlassFieldEditor Text/Slider/Textarea/Date → DS Components (Feb 2025)
- **Text, Number, Date**: MUI `TextField` replaced with DS `MsqdxFormField` (`borderColor="black"`).
- **Textarea**: MUI `TextField` replaced with DS `MsqdxTextareaField` (`minRows={3}`, `size="small"`).
- **Slider**: MUI `Slider` replaced with DS `MsqdxSlider` (`brandColor="black"`, `valueLabelDisplay="on"`, `size="small"`).
- Affects Age, Media Affinity, Location, Full Name and all entity editor fields.

## Remaining Opportunities
- Replace remaining `msqdx-glass-button --ghost` with `MsqdxButton variant="text"` across journey page and other components
- Replace MUI Typography/Box with MsqdxTypography/MsqdxCard where feasible
- MsqdxGlassDashboardCard file still exists (index export) but is unused; can be removed
- Add more token variables for remaining hardcoded values in components
