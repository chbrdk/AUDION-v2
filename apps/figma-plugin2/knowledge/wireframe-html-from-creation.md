# Wireframe-only HTML (CREATION)

The Figma plugin consumes HTML from **CREATION** `generate-site-to-layers` (free-HTML lane). Visual policy (neutral wireframe, no brand colors) is defined in the **CREATION** repo:

- `CREATION/src/lib/wireframe-visual-policy.ts` — `WIREFRAME_VISUAL_POLICY`
- `CREATION/knowledge/wireframe-visual-policy.md` — where it is wired (free HTML + journey screen-brief prompt author)

Do not duplicate the full policy here; update CREATION only.

## Preview URL in the plugin

CREATION returns `meta.previewUrl` (or job-based fallback) in `prompt-site-to-figma-success`; `code.ts` forwards it as `previewUrl`. The Journeys **Sektionen** card shows the full string under **Preview-URL** (`promptSiteLastPreviewUrl`) so designers can open the same HTML the server used for html-to-figma capture.
