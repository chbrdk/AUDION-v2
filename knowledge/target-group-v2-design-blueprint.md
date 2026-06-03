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
| `basics` | basic + metadata | v2: `MsqdxGlassTargetGroupBasicsHero` + description/DE fields; v1: entity editor + metadata grid |
| `personas` | personas | Persona list (v2 links → `ADMIN_ROUTES.personaV2Section`) + create |
| `knowledge` | knowledge | Knowledge entries + add form (`MsqdxGlassPainGoalsSectorSeparator` in v2) |
| `documents` | documents | Upload + ingestion |
| `explorer` | knowledge-explorer | `MsqdxGlassKnowledgeExplorer` |

## Basics v2 stack

- `msqdx-glass-target-group-basics-section` + `msqdx-glass-target-group-basics-stack`
- Hero: name, segment, status (inline edit) + read-only metadata (project, dates)
- Separator → description + bilingual fields via `MsqdxGlassEntityEditor` (name/segment/status excluded)
- Persona list href helper: `targetGroupV2PersonaDetailHref` in `target-group-basics-hero-layout.ts`

## Components

- `MsqdxGlassTargetGroupsV2Overview` — section shell library
- `MsqdxGlassTargetGroupV2DetailLayout` — shell + nav
- `MsqdxGlassTargetGroupAdminSectionView` → panel `presentation="v2-section"`
- `MsqdxGlassTargetGroupBasicsHero` — profile hero for basics section
- `TargetGroupAdminSectionSurface` — flat `PersonaV2SectionBlock` vs accordion

## CSS

- `target-group-v2-section-panel.css`
- `section-shell.css` — `.msqdx-glass-target-group-v2-detail`

## View mode

- Storage: `audion-target-groups-overview-view` (`target-groups-overview-view-mode.ts`)

## i18n

- Namespace: `targetGroupV2.*`
- Nav: `nav.targetGroupsV2`
