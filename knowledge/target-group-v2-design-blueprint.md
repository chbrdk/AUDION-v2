# Target groups v2 — design blueprint

Mirrors **persona v2** shell/nav; content uses standard **msqdx** admin components (no custom hero blocks).

## Routes

- `/admin/target-groups-v2` — library overview
- `/admin/target-groups-v2/:id` → redirect `/basics`
- `/admin/target-groups-v2/:id/:section` — detail section

**Registry:** `apps/web/lib/target-group-v2-sections.ts`  
**Routes:** `ADMIN_ROUTES.targetGroupsV2`, `targetGroupV2Section()`

## Sections

| Section | v1 accordion | Content |
|---------|--------------|---------|
| `basics` | basic + metadata | `MsqdxGlassEntityEditor` + metadata grid (`MsqdxTypography`) |
| `personas` | personas | `MsqdxGlassTargetGroupPersonasPanel` — card/list toggle (shared view-mode storage with persona library), AI generate tile + dialog, avatar cards with key tags |
| `sources` | knowledge + documents | `MsqdxGlassTargetGroupSourcesPanel` — documents grid + upload, knowledge cards + add entry |
| `explorer` | knowledge-explorer | `MsqdxGlassKnowledgeExplorer` |

## Basics (v1 + v2)

- Same components; v2 uses `TargetGroupAdminSectionSurface` with `embedInSection` + optional `MsqdxGlassPainGoalsSectorSeparator` between editor and metadata.
- v2 basics entity editor: `alwaysEditMode` + `bilingualColumns` (EN | DE side-by-side rows via `entity-editor-bilingual-rows.ts`).
- Persona list href: `apps/web/lib/target-group-v2-persona-link.ts`
- Basics metadata block: **Unpublish** (published → draft) and **Delete** via `deleteTargetGroup` + MUI confirm dialog

## Components

- `MsqdxGlassTargetGroupsV2Overview` — section shell library
- `MsqdxGlassTargetGroupV2DetailLayout` — shell + nav
- `MsqdxGlassTargetGroupAdminSectionView` → panel `presentation="v2-section"`
- `TargetGroupAdminSectionSurface` — flat `PersonaV2SectionBlock` vs accordion

## CSS & surfaces

- `target-group-v2-section-panel.css` — shell/scroll + unified accent surfaces (see `knowledge/target-group-v2-surface-tokens.md`)
- `section-shell.css` — `.msqdx-glass-target-group-v2-detail`
- Cards/list rows: **1px solid** accent; create/upload tiles: **1px dashed** accent; transparent card backgrounds

## Headings

- **Workspace (nav section):** `sectionTitle` + `sectionDescription` on `MsqdxGlassTargetGroupV2DetailLayout` (h2 in section shell).
- **Blocks (Basics, Metadata):** `PersonaV2SectionBlock` via `TargetGroupAdminSectionSurface`.
- **Sources subsections:** `PersonaV2SectionBlock` — “Documents (n)” and “Knowledge entries (n)” as mono h3 (not uppercase captions).

## View mode

- Storage: `audion-target-groups-overview-view` (`target-groups-overview-view-mode.ts`)

## i18n

- Namespace: `targetGroupV2.*`
- Nav: `nav.targetGroupsV2`
