# Persona v2 — flat communication section

## Pattern

Same as personality / pain-goals: no `MsqdxDashboardCard` accordion in v2; `embedInSection={isV2Section}` on `MsqdxGlassCommunicationCard`.

## Block order

1. **Vocabulary** — `MsqdxGlassChipEditor` with grid + grey `MsqdxCornerTabCard` shell (`vocab` in `chip-editor-corner-tab.tsx`, `COMMUNICATION_VOCABULARY_CHIP_PROPS`)
2. Sector separator
3. **Sentence structure** — `PersonaV2SectionBlock` + inline `MsqdxGlassFieldEditor` (textarea)
4. Sector separator
5. **Skepticism** — `PersonaV2SectionBlock` + preview bar + slider field editor

## Files

| File | Role |
|------|------|
| `apps/web/components/dashboard-cards/msqdx-glass-communication-card.tsx` | v1 card vs v2 flat stack |
| `apps/web/lib/persona-communication-chip-layout.ts` | Vocabulary chip props |
| `apps/web/styles/dashboard-cards.css` | `.msqdx-glass-communication-section` styles |
