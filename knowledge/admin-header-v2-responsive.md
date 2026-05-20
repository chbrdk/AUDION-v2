# Admin header v2 — responsive behavior

Breakpoints align with `MsqdxAdminNav` drawer mode (`md` / 900px).

| Viewport | Header card |
|----------|-------------|
| ≥1200px | Full inline pickers (project, target group, persona) + page title + chat |
| 900–1199px | Tighter picker widths; title truncates earlier |
| &lt;900px | Compact **fit-content** card (right-aligned in row): `[title][chat][menu]`; menu opens context drawer; row clears nav hamburger (`padding-left: 64px + sm`) |

Tokens: `--msqdx-admin-header-v2-card-action-size` (40px), `--msqdx-admin-header-v2-back-button-size` (55px, desktop back only).

Components: `MsqdxGlassAdminHeaderV2Card`, `MsqdxGlassAdminHeaderV2MenuButton`, `MsqdxGlassAdminHeaderV2ContextDrawer`.
