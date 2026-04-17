# Admin UI: locale-first bilingual fields

- **UX**: One logical field per concept; the visible column follows `useI18n().locale` (`en` | `de`). EN/DE are still stored separately in the API (`name` / `name_de`, etc.).
- **Mirror on save (web)**: `apps/web/lib/bilingual-mirror.ts` — `mirrorFillStringPair` copies non-empty → empty when saving/creating so both sides exist without a second form. This is a **placeholder**, not machine translation; persona generation still does real DE mirrors server-side where implemented.
- **Touches**: `msqdx-glass-project-admin-panel.tsx` (company context + display name), `msqdx-glass-target-groups-overview.tsx` (create card), `msqdx-glass-persona-admin-panel.tsx` (create headline, detail headline edit path, DE profile JSON + system prompt visible only in `de` locale with hints to switch language).
