/**
 * PLEXON platform company id for central project creation (`platform_company_id` on POST /projects).
 * Sources (priority): URL query → sessionStorage → NEXT_PUBLIC_DEFAULT_PLATFORM_COMPANY_ID
 * → optional `default_platform_company_id` from PLEXON profile (server merges into `/api/auth/me`).
 * Query keys are centralized; do not hardcode them in components.
 */

export const PLATFORM_COMPANY_ID_STORAGE_KEY = "audion_platform_company_id";

/** Supported URL param names when deep-linking from PLEXON (or manual testing). */
export const PLATFORM_COMPANY_ID_QUERY_KEYS = ["platformCompanyId", "platform_company_id"] as const;

export const PLATFORM_COMPANY_ID_MAX_LEN = 64;

/** Shared validation for platform company ids (URL, env, PLEXON profile). */
export function normalizePlatformCompanyId(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t || t.length > PLATFORM_COMPANY_ID_MAX_LEN) return null;
  return t;
}

export function readPlatformCompanyIdFromSessionStorage(): string | null {
  if (typeof window === "undefined") return null;
  return normalizePlatformCompanyId(window.sessionStorage.getItem(PLATFORM_COMPANY_ID_STORAGE_KEY));
}

export function writePlatformCompanyIdToSessionStorage(id: string): void {
  const n = normalizePlatformCompanyId(id);
  if (!n || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PLATFORM_COMPANY_ID_STORAGE_KEY, n);
  } catch {
    /* quota / private mode */
  }
}

export function extractPlatformCompanyIdFromSearchParams(params: URLSearchParams): string | null {
  for (const key of PLATFORM_COMPANY_ID_QUERY_KEYS) {
    const v = normalizePlatformCompanyId(params.get(key));
    if (v) return v;
  }
  return null;
}

/** When the URL carries a company hint, persist it for later navigations (same tab). */
export function persistPlatformCompanyIdFromUrl(params: URLSearchParams): void {
  const fromUrl = extractPlatformCompanyIdFromSearchParams(params);
  if (fromUrl) writePlatformCompanyIdToSessionStorage(fromUrl);
}

export function getDefaultPlatformCompanyIdFromEnv(): string | null {
  if (typeof process === "undefined") return null;
  return normalizePlatformCompanyId(process.env.NEXT_PUBLIC_DEFAULT_PLATFORM_COMPANY_ID);
}

export type ResolvePlatformCompanyIdOptions = {
  /** From `/api/auth/me` after PLEXON profile merge (`default_platform_company_id`). */
  plexonDefaultCompanyId?: string | null;
};

/**
 * Resolves the id to send as `platform_company_id` on project create / bootstrap.
 * Prefer current URL, then tab session, then optional public env default, then PLEXON profile default.
 */
export function resolvePlatformCompanyIdForApi(
  params: URLSearchParams | null,
  options?: ResolvePlatformCompanyIdOptions
): string | null {
  const fromUrl = params ? extractPlatformCompanyIdFromSearchParams(params) : null;
  if (fromUrl) return fromUrl;
  const stored = readPlatformCompanyIdFromSessionStorage();
  if (stored) return stored;
  const fromEnv = getDefaultPlatformCompanyIdFromEnv();
  if (fromEnv) return fromEnv;
  return normalizePlatformCompanyId(options?.plexonDefaultCompanyId);
}
