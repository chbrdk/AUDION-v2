/** Desktop inset so header chrome clears the MsqdxAppLayout logo corner (matches legacy bar). */
export const ADMIN_HEADER_LOGO_INSET_PX = 230;

export const ADMIN_HEADER_V2_BAR_CLASS = "msqdx-glass-admin-header-bar--v2-card";
export const ADMIN_HEADER_V2_CARD_CLASS = "msqdx-glass-admin-header-card";
export const ADMIN_HEADER_V2_CARD_START_CLASS = "msqdx-glass-admin-header-card__start";
export const ADMIN_HEADER_V2_CARD_END_CLASS = "msqdx-glass-admin-header-card__end";
export const ADMIN_HEADER_V2_CARD_DIVIDER_CLASS = "msqdx-glass-admin-header-card__divider";

export const ADMIN_HEADER_V2_CARD_MIN_HEIGHT_PX = 54;

export function isPersonasV2AdminPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith("/admin/personas-v2"));
}
