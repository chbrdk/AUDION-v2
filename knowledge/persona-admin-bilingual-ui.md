# Persona admin bilingual UI

- **Canonical English** lives in `personas` columns / `profile` JSON. **German mirror** is `profile_de` (same keys as `profile` where applicable) plus `headline_de`.
- **Admin translate API**: `POST /api/persona-admin/{persona_id}/translate-fields` with `{ "from_locale": "en"|"de", "strings": { "headline": "...", "bio": "..." } }`. Next.js must expose `app/api/persona-admin/[personaId]/translate-fields/route.ts` (proxy to persona-api). Web helper: `apps/web/lib/persona-translate-fields.ts` + path `API_ROUTES.personaAdminTranslateFields` in `apps/web/lib/api-routes.ts`.
- **UX**: One visible field per concept in the current UI language; on save, the other locale is filled via translate (fallback: `mirrorFillStringPair` in `apps/web/lib/bilingual-mirror.ts`).
- **PATCH `profile_de`**: The API requires `json_shape_compatible(profile, profile_de)` (same keys everywhere, matching list lengths and nested object keys). Use `alignProfileDeToEnProfile` in `apps/web/lib/persona-profile-de-shape.ts` after merging partial DE updates so the payload is never a sparse object.
- **Chat system prompt** is not shown on the persona admin page; use **Ensure chat prompt** or server flows to update it.
