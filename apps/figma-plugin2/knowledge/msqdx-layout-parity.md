# Figma plugin UI ↔ MSQDX / Audion Web

The plugin shell mirrors **`MsqdxAppLayout`** without sidebar + **`MsqdxCornerBox`** (logo + app name), as used on the web in:

- `apps/web/components/chat/chat-share-layout.tsx` (`innerBackground="grid"`, `borderWidth="thick"`, `logo` + `appName="Audion"`)
- Admin uses the same layout with sidebar (different corner radii); the plugin intentionally matches the **no-sidebar** variant.

## Central config

- `src/config/msqdx-plugin-layout.ts` — `MSQDX_PLUGIN_BRAND_CSS_VAR` (`var(--msqdx-primary)`), border width (thick = 10px), radii (32 / 56), grid background, inner neutral color `#f8f6f0`.
- `src/components/MsqdxPluginCornerHeader.tsx` — cutdown patches aligned with `MsqdxCornerBox` (`topRight: cutdown-a`, `bottomLeft: cutdown-b`, `bottomRight: rounded`). Wordmark only (no separate “Audion” title) to save width in the narrow panel.

## Resizable panel

Figma does not expose a native drag edge for plugin modals; we use a **bottom-right handle** (`PluginResizeHandle`) + `figma.ui.resize` in `code.ts`. Sizes are clamped and persisted in `figma.clientStorage` (`src/config/plugin-ui.ts`).

## Brand color

`--msqdx-primary` is set from plugin settings (`brandColor`); outer frame and corner use the same CSS variable as the web theme accent.

Design system source (monorepo): `MSQDX-DS/msqdx-design-system/.../MsqdxAppLayout.tsx`, `MsqdxCornerBox.tsx`, `packages/tokens/src/tokens/spacing.ts`.
