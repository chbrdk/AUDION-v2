/**
 * AUDION – Auth via PLEXON (zentrale User-DB nur in PLEXON).
 * Wenn PLEXON_AUTH_URL und PLEXON_SERVICE_SECRET gesetzt sind, wird der Login
 * zuerst gegen PLEXON validiert; das Persona-Backend erhält danach einen
 * Aufruf (Login/Register mit abgeleitetem Passwort oder /auth/plexon).
 */

const PLEXON_AUTH_URL = process.env.PLEXON_AUTH_URL ?? "";
const PLEXON_SERVICE_SECRET = process.env.PLEXON_SERVICE_SECRET ?? "";

export function isPlexonAuthConfigured(): boolean {
  return Boolean(PLEXON_AUTH_URL.trim() && PLEXON_SERVICE_SECRET.trim());
}

export type PlexonAuthUser = { id: string; email: string; name?: string };

/**
 * Validiert E-Mail/Passwort gegen PLEXON.
 */
export async function validateCredentialsWithPlexon(
  email: string,
  password: string
): Promise<PlexonAuthUser | null> {
  if (!PLEXON_AUTH_URL.trim() || !PLEXON_SERVICE_SECRET.trim()) return null;
  const url = `${PLEXON_AUTH_URL.replace(/\/$/, "")}/api/auth/validate-credentials`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": PLEXON_SERVICE_SECRET,
      },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: PlexonAuthUser };
    return data?.user ?? null;
  } catch (e) {
    console.error("[AUDION] PLEXON auth error:", e);
    return null;
  }
}

import { createHmac } from "crypto";

/**
 * Deterministisches Passwort für einen PLEXON-User, damit das Persona-Backend
 * ohne Anpassung genutzt werden kann: zuerst Login, bei 401 Register mit diesem Passwort.
 */
export function getPlexonDerivedPassword(plexonUserId: string): string {
  return createHmac("sha256", PLEXON_SERVICE_SECRET)
    .update(plexonUserId)
    .digest("base64url")
    .slice(0, 32);
}
