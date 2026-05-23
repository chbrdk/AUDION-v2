# Persona v2 — flat communication section

## Pattern

Same as personality / pain-goals: no `MsqdxDashboardCard` accordion in v2; `embedInSection={isV2Section}` on `MsqdxGlassCommunicationCard`.

## Block order

1. **Vocabulary** — `MsqdxGlassChipEditor` with grid + grey `MsqdxCornerTabCard` shell (`vocab` in `chip-editor-corner-tab.tsx`, `COMMUNICATION_VOCABULARY_CHIP_PROPS`)
2. Sector separator
3. **Sentence structure** — `MsqdxGlassChipEditor` (`maxChips={1}`, `showEmptyEntryChip`, `--sentence`, `COMMUNICATION_SENTENCE_CHIP_PROPS`, corner tab `sentence` / `format_quote`)
4. Sector separator
5. **Skepticism** — `PersonaV2SectionBlock` + preview bar + slider field editor

## Files

| File | Role |
|------|------|
| `apps/web/components/dashboard-cards/msqdx-glass-communication-card.tsx` | v1 card vs v2 flat stack |
| `apps/web/lib/persona-communication-chip-layout.ts` | Vocabulary + sentence chip props |
| `apps/web/components/generic/msqdx-glass-chip-editor.tsx` | `showEmptyEntryChip`, `maxChips` for single-entry sections |
| `apps/web/styles/dashboard-cards.css` | `.msqdx-glass-communication-section` styles |
