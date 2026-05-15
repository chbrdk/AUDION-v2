export const PLEXON_SOURCE_PARAM = "plexon_source";
export const PLEXON_RETURN_TO_PARAM = "plexon_return_to";
export const PLEXON_RETURN_TO_STORAGE_KEY = "audion_plexon_return_to";

function originFromUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/** Public PLEXON app origin (register URL or auth URL). */
export function getPlexonAppOrigin(): string | null {
  return (
    originFromUrl(process.env.NEXT_PUBLIC_PLEXON_REGISTER_URL) ??
    originFromUrl(process.env.NEXT_PUBLIC_PLEXON_AUTH_URL)
  );
}

function getConfiguredPlexonOrigin(): string | null {
  return getPlexonAppOrigin();
}

/** PLEXON platform project dashboard — `/projects/{platformProjectId}`. */
export function buildPlexonPlatformProjectDashboardUrl(platformProjectId: string): string | null {
  const origin = getPlexonAppOrigin();
  const id = platformProjectId.trim();
  if (!origin || !id) return null;
  return `${origin}/projects/${encodeURIComponent(id)}`;
}

export function normalizePlexonReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  const allowedOrigin = getConfiguredPlexonOrigin();
  if (!allowedOrigin) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    if (url.origin !== allowedOrigin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function extractPlexonReturnToFromRedirect(redirect: string | null | undefined): string | null {
  if (!redirect) return null;
  const query = redirect.includes("?") ? redirect.slice(redirect.indexOf("?") + 1) : "";
  if (!query) return null;
  const params = new URLSearchParams(query);
  return normalizePlexonReturnTo(params.get(PLEXON_RETURN_TO_PARAM));
}

/** PLEXON `/forgot-password` — same origin as `NEXT_PUBLIC_PLEXON_REGISTER_URL`. */
export function getPlexonForgotPasswordUrl(): string | null {
  const origin = getConfiguredPlexonOrigin();
  if (!origin) return null;
  return `${origin}/forgot-password`;
}
