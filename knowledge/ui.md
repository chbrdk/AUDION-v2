# UI Knowledge Base

## Branding Assets
- **MSQDX Logo**: Stored at `apps/web/public/assets/@msqdx-logo.svg`. Reference via `BRAND_LOGO` from `apps/web/lib/branding.ts` (do not hardcode the path). Version created on 2025-11-19 with gradient orb + stroke wordmark for consistency with current light theme.

## Typography
- **Primary Font**: `Noto Sans JP` (Google Fonts). Loaded through `next/font` in `apps/web/app/layout.tsx` using the CSS variable `--font-noto-sans-jp`.
- **Fallback Stack**: Defined once in `BRAND_FONT_FAMILY` (`apps/web/lib/branding.ts`) and reused by the MUI theme and global styles to maintain consistency across components.

## Color Tokens
Defined in `apps/web/styles/globals.css` under `:root` for reuse across components:
- `--color-primary-white: #fff`
- `--color-secondary-dx-yellow: #fef14d`
- `--color-secondary-dx-yellow-tint: #f3f0c8`
- `--color-secondary-dx-pink: #f256b6`
- `--color-secondary-dx-pink-tint: #f3d9e3`
- `--color-secondary-dx-pink-on-light: #d5108a`
- `--color-secondary-dx-orange: #ff6a3b`
- `--color-secondary-dx-orange-overlay-20: rgba(255, 106, 59, 0.2)`
- `--color-secondary-dx-orange-tint: #f8d5cb`
- `--color-secondary-dx-purple: #b638ff`
- `--color-secondary-dx-green: #00ca55`
- `--color-secondary-dx-green-tint: #dff1e1`
- `--color-secondary-dx-grey-light: #d4d2d2`
- `--color-secondary-dx-grey-light-tint: rgba(212, 210, 210, 0.5)`
- `--color-neutral: #f8f6f0`

## Persona Admin API Helpers
- Server routes under `apps/web/app/api/persona-admin/**` must reuse the shared helper at `apps/web/app/api/_lib/persona.ts`.
- `forwardPersonaBackend()` handles caching headers + internal/public URL switching via `getPersonaBackendBase`; do not reimplement fetch forwarding inside individual route files.
- `resolvePersonaParams()` accepts `params` as object or promise (Next.js dynamic routes) and normalizes them; destructure from it instead of accessing `context.params` directly.
- When exposing new Persona backend endpoints, add thin wrappers under `app/api/persona-admin/...` that call `forwardPersonaBackend("/personas/:id/<path>")` so TypeScript + env wiring stays centralized.

