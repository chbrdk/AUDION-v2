/**
 * PLEXON platform company id for central project creation (`platform_company_id` on POST /projects).
 * Sources (priority): URL query → sessionStorage → NEXT_PUBLIC_DEFAULT_PLATFORM_COMPANY_ID.
 * Query keys are centralized; do not hardcode them in components.
 */

export const PLATFORM_COMPANY_ID_STORAGE_KEY = "audion_platform_company_id";

/** Supported URL param names when deep-linking from PLEXON (or manual testing). */
export const PLATFORM_COMPANY_ID_QUERY_KEYS = ["platformCompanyId", "platform_company_id"] as const;

const MAX_LEN = 64;

function normalizeId(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t || t.length > MAX_LEN) return null;
  return t;
}

export function readPlatformCompanyIdFromSessionStorage(): string | null {
  if (typeof window === "undefined") return null;
  return normalizeId(window.sessionStorage.getItem(PLATFORM_COMPANY_ID_STORAGE_KEY));
}

export function writePlatformCompanyIdToSessionStorage(id: string): void {
  const n = normalizeId(id);
  if (!n || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PLATFORM_COMPANY_ID_STORAGE_KEY, n);
  } catch {
    /* quota / private mode */
  }
}

export function extractPlatformCompanyIdFromSearchParams(params: URLSearchParams): string | null {
  for (const key of PLATFORM_COMPANY_ID_QUERY_KEYS) {
    const v = normalizeId(params.get(key));
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
  return normalizeId(process.env.NEXT_PUBLIC_DEFAULT_PLATFORM_COMPANY_ID);
}

/**
 * Resolves the id to send as `platform_company_id` on project create / bootstrap.
 * Prefer current URL, then tab session, then optional public env default.
 */
export function resolvePlatformCompanyIdForApi(params: URLSearchParams | null): string | null {
  const fromUrl = params ? extractPlatformCompanyIdFromSearchParams(params) : null;
  if (fromUrl) return fromUrl;
  const stored = readPlatformCompanyIdFromSessionStorage();
  if (stored) return stored;
  return getDefaultPlatformCompanyIdFromEnv();
}
