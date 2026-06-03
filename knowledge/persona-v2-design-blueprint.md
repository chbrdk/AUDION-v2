# Persona v2 — Design Blueprint (canonical reference)

> **Purpose:** Single source of truth for the personas v2 UI. Use this when refactoring **target groups v2** (and any other entity v2) so patterns stay aligned with MSQDX design system conventions — not one-off hacks.

**Related docs:** `persona-v2-section-chip-layout.md`, `persona-v2-basics-flat-section.md`, `persona-v2-library-view-toggle.md`, `personas-target-groups-routing.md`

---

## 1. Architecture at a glance

```
/admin/personas-v2                    → Library (section shell, no sub-nav)
/admin/personas-v2/:id              → redirect → /basics
/admin/personas-v2/:id/:section     → Detail (section shell + sub-nav + one section body)
```

**Routes:** `apps/web/lib/routes.ts` — `ADMIN_ROUTES.personasV2`, `personaV2Section(id, section)`  
**Section registry:** `apps/web/lib/persona-v2-sections.ts`  
**Visibility:** `apps/web/lib/persona-v2-section-visibility.ts`  
**Layout CSS:** `section-shell.css`, `persona-v2-section-panel.css`, `dashboard-cards.css`, `admin-header-v2.css`

---

## 2. Page shells (copy for target groups v2)

### 2.1 Library overview

| Prop / pattern | Value |
|----------------|-------|
| Component | `MsqdxGlassSectionShell` |
| `hideSubNav` | `true` |
| `scopeLabel` | Entity family, e.g. `personaV2.scopeLabel` → "Personas" |
| `entityTitle` | Page title, e.g. "Persona library" |
| `entitySubtitle` | **omit** (no preview copy) |
| `headerActions` | Optional escape hatch (classic list link) |
| `sectionTitle` | List heading, e.g. "All personas" |
| `sectionDescription` | **omit** |
| `workspaceActions` | Toolbar (card/list toggle) |
| Content | Reuse overview component + `getDetailHref` override |

**Files:** `msqdx-glass-personas-v2-overview.tsx`, `msqdx-glass-personas-overview.tsx`

### 2.2 Entity detail

| Prop / pattern | Value |
|----------------|-------|
| `className` | `msqdx-glass-persona-v2-detail` (scroll overrides) |
| `entityTitle` / `entitySubtitle` | Fetched entity name + segment |
| `entityCornerAccent` | `true` — black `MsqdxCornerBox` in nav rail (desktop) |
| `wideContent` | `true` |
| `navItems` | From section registry + i18n |
| `activeSectionId` | Current route section |
| `sectionTitle` / `sectionDescription` | **omit** — nav owns section naming |
| Back | `MsqdxGlassAdminHeaderBackIconButton` via `useAdminHeader().setHeaderStartContent` |
| Header pickers | `useAdminHeaderV2Context()` on v2 paths |

**Files:** `msqdx-glass-persona-v2-detail-layout.tsx`, `msqdx-glass-persona-v2-section-content.tsx`

---

## 3. Section content pattern (the v2 contract)

Every migrated section follows this chain:

```
MsqdxGlassPersonaAdminPanel
  presentation="v2-section"
  visibleSection={sectionId}
  mode="detail"
  activePersonaId={id}
```

Inside the panel:

1. Root: `.msqdx-glass-persona-v2-section-panel` + `.msqdx-glass-dashboard-grid--v2-section` (flex column, gap `--msqdx-spacing-lg`)
2. Gate: `showSection("section-id")` via `isPersonaV2SectionContentVisible`
3. Surface: `PersonaAdminSectionSurface embedInSection={isV2Section}` **or** dedicated v2-only component
4. When `embedInSection`: renders `PersonaV2SectionBlock` (flat article, optional mono h3) — **no** `MsqdxDashboardCard` accordion
5. Multi-block sections: vertical stack + `MsqdxGlassPainGoalsSectorSeparator` between blocks

**Key wrappers:**

| Component | Role |
|-----------|------|
| `PersonaAdminSectionSurface` | v1 accordion vs v2 flat block switch |
| `PersonaV2SectionBlock` | Flat block + `MsqdxTypography h3` + `SECTION_HEADING_MONO_SX` |
| `MsqdxGlassChipEditor` | Chip sections (inline / grid / slider / list) |
| `MsqdxGlassPersonaChip` | Read-only / editable persona tags |

---

## 4. Design system component matrix

### ✅ Canonical (@msqdx/react)

| Component | v2 usage |
|-----------|----------|
| `MsqdxCornerBox` | Workspace dock, nav dock, entity accent |
| `MsqdxButton` | Primary/secondary actions |
| `MsqdxIcon` | Icons everywhere |
| `MsqdxTypography` | Section headings, body copy |
| `MsqdxChip` | Status/meta chips (moodboard, UX runs, warnings) |
| `MsqdxMoleculeCard` | Library cards + create card |
| `MsqdxAvatar` | Library avatars |
| `MsqdxFormField` / `MsqdxTextareaField` | Forms |
| `MsqdxSelect` | Metadata assignment |
| `MsqdxDashboardCard` | **v1 only** (or unmigrated sections) |

### ✅ Canonical (local glass layer — app DS extensions)

| Component | v2 usage |
|-----------|----------|
| `MsqdxGlassSectionShell` | All v2 pages |
| `MsqdxGlassChipEditor` | Personality, communication, pain-goals |
| `MsqdxGlassPersonaChip` | Library key tags, chip sections |
| `MsqdxGlassFieldEditor` / `MsqdxGlassEditButton` | Inline field edit (basics) |
| `MsqdxGlassPainGoalsSectorSeparator` | Block dividers |
| `MsqdxGlassPersonaBasicsHero` | Basics hero (custom but tokenized CSS) |
| `MsqdxGlassPersonaMoodboardSection` | Immersive custom section |
| `MsqdxGlassPersonaUxHistorySection` | Timeline custom section |

### ⚠️ Acceptable MUI (layout primitives only)

- `Box`, `Stack` — layout wrappers
- `useMediaQuery` in section shell

### ❌ Sonderlösungen / tech debt (do NOT copy to target groups v2)

| Issue | Location | Fix before TG v2 |
|-------|----------|------------------|
| **Knowledge still v1 accordion** | `MsqdxGlassKnowledgeSourcesCard` — no `embedInSection` | Migrate to flat stack |
| **Raw MUI forms in library** | `Dialog`, `TextField`, `Select`, `IconButton` in create/AI flow | Prefer `MsqdxFormField`, DS dialog pattern |
| **Layout toggle = custom MUI IconButtons** | `personas-overview-layout-toggle.tsx` | Extract DS toggle or document as shared pattern |
| **Heavy inline `sx` accent hacks** | `msqdx-glass-personas-overview.tsx` — borders, `!important` buttons, `rgba` hovers | Move to CSS classes + tokens |
| **Basics hero raw MUI** | `TextField`, `IconButton`, hardcoded EN `aria-label` | `MsqdxFormField`, i18n |
| **MUI Alert / CircularProgress** | moodboard, UX history, metadata | Consider DS empty/loading states |
| **styled-jsx in bio card** | `@keyframes slideIn` inline | Move to CSS file |
| **Hardcoded paths** | `/admin/chat?personaId=`, inline hrefs | `routes.ts` |
| **Dual v1/v2 in admin panel** | ~3000 lines branching | Long-term: extract v2 section renderers |
| **Grid tuning only in `sx`** | `msqdx-glass-personas-v2-overview-grid` — no CSS file | Add scoped CSS like personas overview chips |

---

## 5. Section migration status

| Section | v2 flat? | Pattern |
|---------|----------|---------|
| basics | ✅ | Hero + bio stack + integrations; `MsqdxGlassPersonaBasicsHero` |
| personality | ✅ | `embedInSection` + chip editor (traits inline, interests/values/social grid) |
| communication | ✅ | `embedInSection` + chip editor |
| pain-goals | ✅ | `embedInSection` + slider layout |
| knowledge | ❌ | Still `MsqdxDashboardCard` accordion |
| ux-history | ✅ | Dedicated `MsqdxGlassPersonaUxHistorySection` |
| moodboard | ✅ | Dedicated `MsqdxGlassPersonaMoodboardSection` |

---

## 6. Chip layout decision tree

See `persona-v2-section-chip-layout.md`. Summary:

| Layout | Use when |
|--------|----------|
| `inline` | Wrapping tags (traits) |
| `grid` | 2→3 col tag grids (interests, values, vocab) |
| `slider` | Narrative cards with corner-tab chrome (pain, goals) |
| `list` | Long text per row |
| Custom BEM section | Moodboard, UX history, basics hero |

---

## 7. Typography & spacing tokens

| Token | Typical v2 use |
|-------|----------------|
| `--msqdx-spacing-xxs` … `--msqdx-spacing-xl` | Gaps, padding |
| `--msqdx-radius-sm`, `--msqdx-radius-3xl` | Nav cards, avatars |
| `--msqdx-section-workspace-frame-radius` | 36px workspace frame |
| `SECTION_HEADING_MONO_SX` | Section block h3 (IBM Plex Mono) |
| `--color-theme-accent` / `--color-theme-accent-contrast` | Nav active, borders, buttons |

**Section headings:** `PersonaV2SectionBlock` → `MsqdxTypography variant="h3"` + mono sx  
**Shell entity title:** `.msqdx-glass-section-shell__title` (CSS, not inline)

---

## 8. i18n convention

| Namespace | Scope |
|-----------|-------|
| `personaV2.*` | Shell, nav labels, library toggle, moodboard, UX history |
| `personaAdmin.*` | Field labels, toasts, chip section titles, create flows |
| `common.*` | cancel, save |

Nav wiring: `labelKey` / `descriptionKey` on section defs → `t(s.labelKey)`.

**Do for target groups v2:** `targetGroupV2.sections.{id}.label` mirror pattern.

---

## 9. Library overview specifics

- **View modes:** `personas-overview-view-mode.ts` → localStorage `audion-personas-overview-view`
- **Key tags:** `persona-list-key-tags.ts` — up to 3 tags from profile (not confidence %)
- **Compact chips:** `.msqdx-glass-personas-overview .msqdx-glass-chip.--dashboard` in `globals.css`
- **No preview banners** — production-ready shell copy only

---

## 10. Target groups v2 — implementation checklist

Mirror personas v2 file-for-file:

```
apps/web/lib/target-group-v2-sections.ts       ← persona-v2-sections.ts
apps/web/lib/routes.ts                         ← targetGroupsV2, targetGroupV2Section()
apps/web/app/admin/target-groups-v2/           ← layout, page, [id], [id]/[section]
apps/web/components/target-groups-v2/
  msqdx-glass-target-groups-v2-overview.tsx
  msqdx-glass-target-group-v2-detail-layout.tsx
  msqdx-glass-target-group-v2-section-content.tsx
  target-group-v2-section-block.tsx            ← reuse or alias PersonaV2SectionBlock pattern
apps/web/styles/target-group-v2-section-panel.css
knowledge/target-group-v2-design-blueprint.md  ← fork from this doc
```

**Reuse without copy-paste where possible:**

- `MsqdxGlassSectionShell` (unchanged)
- `PersonaV2SectionBlock` → rename/generalize to `EntityV2SectionBlock` (optional refactor)
- `PersonaAdminSectionSurface` pattern → `TargetGroupAdminSectionSurface`
- Section separator, chip editor, typography tokens

**Define target group sections** (example — adjust to product):

- basics (name, segment, description, project assignment)
- personas (linked personas list)
- knowledge / documents
- settings / generation

**Avoid from day one:**

- Preview subtitles/banners
- Confidence % in library cards
- Raw MUI dialogs where DS form fields exist
- Accordion cards inside v2 shell
- Inline accent `sx` — use CSS + theme vars

---

## 11. Key CSS classes (bookmark)

```
/* Shell */
.msqdx-glass-section-shell
.msqdx-glass-section-shell--entity-accent-in-nav
.msqdx-glass-section-workspace--with-subnav
.msqdx-glass-section-workspace__content--wide

/* Detail panel */
.msqdx-glass-persona-v2-detail
.msqdx-glass-persona-v2-section-panel
.msqdx-glass-dashboard-grid--v2-section
.msqdx-glass-persona-v2-section-block

/* Section stacks */
.msqdx-glass-personality-section / -stack__block
.msqdx-glass-communication-section / -stack__block
.msqdx-glass-pain-goals-section / -stack__block
.msqdx-glass-pain-goals-sector-separator

/* Custom sections */
.msqdx-glass-persona-basics-hero__*
.msqdx-glass-moodboard-section
.msqdx-glass-ux-history-section

/* Library */
.msqdx-glass-personas-overview
.msqdx-glass-personas-grid | -list
.msqdx-glass-personas-layout-toggle
```

---

## 12. Tests to mirror for TG v2

- Section href resolution + legacy aliases
- Section visibility gating
- Workspace scroll/padding contracts
- Overview wiring (no preview copy)
- CSS class contracts (vitest readFileSync pattern)

Existing: `persona-v2-sections.test.ts`, `persona-v2-section-visibility.test.ts`, `personas-v2-overview.test.ts`, `persona-v2-workspace-padding.test.ts`

---

*Last audited: 2026-06 — personas v2 library + 7 detail sections.*
