# Target Group v2 — Surface tokens

Unified borders and backgrounds for TG v2 library, detail sections (personas, sources), and basics metadata.

## Rules

| Surface | Border | Background |
|--------|--------|------------|
| Content card / list row (item) | `1px solid` theme accent | transparent |
| Create / add / upload tile | `1px dashed` theme accent | transparent |
| Media band inside card | none | `rgba(0,0,0,0.03)` (dark: see `globals.css`) |
| Metadata rail (basics) | `1px solid` accent left | — |
| Form fields | accent via `FORM_FIELD_ACCENT_SX` | default input |

Do **not** use `2px` borders, neutral `divider` borders, or mixed dashed weights in v2 surfaces.

## Code

- Tokens: `apps/web/lib/target-group-v2-surface-styles.ts`
- CSS: `apps/web/styles/target-group-v2-section-panel.css` (scoped under `.msqdx-glass-target-group-v2-detail` and `.msqdx-glass-target-groups-v2-overview-grid`)
- List create row: both `msqdx-tg-v2-surface-list-row` and `msqdx-tg-v2-surface-create` → dashed via combined selector

## Subsection headings (Sources, Basics blocks)

Use `PersonaV2SectionBlock` with `title` — mono **h3** (`msqdx-glass-chip-editor__section-heading`), same as persona v2 and TG basics/metadata. Do not use uppercase `caption` labels.

Workspace area title (nav section): `MsqdxGlassSectionShell` `sectionTitle` / `sectionDescription` on TG v2 detail layout.

## Usage

```tsx
import { TG_V2_SURFACE_CLASS, tgV2CardSurfaceSx, tgV2CreateSurfaceSx } from "../lib/target-group-v2-surface-styles";
import { PersonaV2SectionBlock } from "../personas-v2/persona-v2-section-block";

<PersonaV2SectionBlock title="Documents (3)">…</PersonaV2SectionBlock>
<MsqdxMoleculeCard className={TG_V2_SURFACE_CLASS.card} sx={tgV2CardSurfaceSx()} />
<MsqdxMoleculeCard className={TG_V2_SURFACE_CLASS.create} sx={tgV2CreateSurfaceSx()} />
```

Overview: `MsqdxGlassTargetGroupsOverview` with `useV2Surfaces`.
