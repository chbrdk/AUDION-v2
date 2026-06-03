# Persona v2 — UX history section UI

- Component: `apps/web/components/personas-v2/msqdx-glass-persona-ux-history-section.tsx`
- Styles: `apps/web/styles/dashboard-cards.css` (`.msqdx-glass-ux-history-*`)
- Wired in `msqdx-glass-persona-admin-panel.tsx` when `presentation === "v2-section"` and section `ux-history`
- Neutral atmosphere header (no glow cards), timeline list with run cards
- CTAs: **Im Chat starten** (`/admin/chat?personaId=…`), **UX-Agent** (`ADMIN_ROUTES.uxJourneyAgent`)
- i18n: `personaV2.uxHistory.*`
