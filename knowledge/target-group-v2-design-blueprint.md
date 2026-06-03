# Target groups v2 — design blueprint

Mirrors **persona v2** (`knowledge/persona-v2-design-blueprint.md`).

## Routes

- `/admin/target-groups-v2` — library overview
- `/admin/target-groups-v2/:id` → redirect `/basics`
- `/admin/target-groups-v2/:id/:section` — detail section

**Registry:** `apps/web/lib/target-group-v2-sections.ts`  
**Routes:** `ADMIN_ROUTES.targetGroupsV2`, `targetGroupV2Section()`

## Sections

| Section | v1 accordion | Content |
|---------|--------------|---------|
| `basics` | basic + metadata | Entity editor + metadata grid |
| `personas` | personas | Persona list + create |
| `knowledge` | knowledge | Knowledge entries |
| `documents` | documents | Upload + ingestion |
| `explorer` | knowledge-explorer | `MsqdxGlassKnowledgeExplorer` |

## Components

- `MsqdxGlassTargetGroupsV2Overview` — section shell library
- `MsqdxGlassTargetGroupV2DetailLayout` — shell + nav
- `MsqdxGlassTargetGroupAdminSectionView` → panel `presentation="v2-section"`
- `TargetGroupAdminSectionSurface` — flat `PersonaV2SectionBlock` vs accordion

## CSS

- `target-group-v2-section-panel.css`
- `section-shell.css` — `.msqdx-glass-target-group-v2-detail`

## View mode

- Storage: `audion-target-groups-overview-view` (`target-groups-overview-view-mode.ts`)

## i18n

- Namespace: `targetGroupV2.*`
- Nav: `nav.targetGroupsV2`
