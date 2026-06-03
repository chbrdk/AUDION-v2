/** Desktop inset so header chrome clears the MsqdxAppLayout logo corner (matches legacy bar). */
export const ADMIN_HEADER_LOGO_INSET_PX = 230;

export const ADMIN_HEADER_V2_BAR_CLASS = "msqdx-glass-admin-header-bar--v2-card";
export const ADMIN_HEADER_V2_ROW_CLASS = "msqdx-glass-admin-header-v2-row";
export const ADMIN_HEADER_V2_BACK_SLOT_CLASS = "msqdx-glass-admin-header-v2-back";
export const ADMIN_HEADER_V2_CARD_CLASS = "msqdx-glass-admin-header-card";
export const ADMIN_HEADER_V2_CARD_START_CLASS = "msqdx-glass-admin-header-card__start";
export const ADMIN_HEADER_V2_CARD_END_CLASS = "msqdx-glass-admin-header-card__end";
export const ADMIN_HEADER_V2_CARD_PICKER_DIVIDER_CLASS = "msqdx-glass-admin-header-card__picker-divider";

export const ADMIN_HEADER_V2_CARD_MIN_HEIGHT_PX = 54;
/** Back control in v2 header row (compact square; smaller than card chrome block). */
export const ADMIN_HEADER_V2_BACK_BUTTON_SIZE_PX = 55;
/** In-card actions (e.g. chat) aligned to header card chrome. */
export const ADMIN_HEADER_V2_CARD_ACTION_SIZE_PX = 40;

/** Matches MsqdxAdminNav drawer mode (`theme.breakpoints.down("md")`). */
export const ADMIN_HEADER_V2_MOBILE_MAX_WIDTH_PX = 899;
/** Tighter inline pickers before switching to the context drawer. */
export const ADMIN_HEADER_V2_COMPACT_PICKERS_MAX_WIDTH_PX = 1199;

export const ADMIN_HEADER_V2_CARD_PICKERS_DESKTOP_CLASS =
  "msqdx-glass-admin-header-card__pickers-desktop";
export const ADMIN_HEADER_V2_MENU_BUTTON_WRAP_CLASS =
  "msqdx-glass-admin-header-v2-menu-button-wrap";
export const ADMIN_HEADER_V2_CONTEXT_DRAWER_CLASS =
  "msqdx-glass-admin-header-v2-context-drawer";

export function isPersonasV2AdminPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith("/admin/personas-v2"));
}

export function isTargetGroupsV2AdminPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith("/admin/target-groups-v2"));
}

export function isEntityV2AdminPath(pathname: string | null | undefined): boolean {
  return isPersonasV2AdminPath(pathname) || isTargetGroupsV2AdminPath(pathname);
}

/** Clears the v2 header card row inside `main` (back + header card + vertical padding). */
export const ADMIN_CONTENT_PADDING_TOP_V2 = `calc(${ADMIN_HEADER_V2_BACK_BUTTON_SIZE_PX}px + var(--msqdx-spacing-md) + var(--msqdx-spacing-sm))`;
