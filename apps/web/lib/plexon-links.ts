export const PLEXON_SOURCE_PARAM = "plexon_source";
export const PLEXON_RETURN_TO_PARAM = "plexon_return_to";
export const PLEXON_RETURN_TO_STORAGE_KEY = "audion_plexon_return_to";

function getConfiguredPlexonOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_PLEXON_REGISTER_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
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
