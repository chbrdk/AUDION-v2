/**
 * AUDION – Auth via PLEXON (zentrale User-DB nur in PLEXON).
 * Wenn PLEXON_AUTH_URL und PLEXON_SERVICE_SECRET gesetzt sind, wird der Login
 * zuerst gegen PLEXON validiert; das Persona-Backend erhält danach einen
 * Aufruf (Login/Register mit abgeleitetem Passwort oder /auth/plexon).
 */

import { createHmac } from "crypto";

import { getPlexonContractHeaders } from "./plexon-contract";

/**
 * PLEXON-Env zur Laufzeit lesen (nicht beim Modul-Import cachen).
 * Sonst kann ein Production-Build ohne diese Variablen leere Strings „einbacken“
 * und Coolify-Runtime-Env wird ignoriert → kein PLEXON-Call, nur Backend-Login mit Klartext → 401.
 */
function getPlexonAuthUrl(): string {
  return (process.env.PLEXON_AUTH_URL ?? "").trim();
}

export function getPlexonServiceSecret(): string {
  return (process.env.PLEXON_SERVICE_SECRET ?? "").trim();
}

export function isPlexonAuthConfigured(): boolean {
  return Boolean(getPlexonAuthUrl() && getPlexonServiceSecret());
}

/** Für Health/Debug: keine Secrets, nur ob die Web-App PLEXON-Login aktivieren würde. */
export function getPlexonAuthHealthSnapshot(): {
  plexonAuthUrlSet: boolean;
  plexonServiceSecretSet: boolean;
  plexonAuthActive: boolean;
} {
  const urlSet = Boolean(getPlexonAuthUrl());
  const secretSet = Boolean(getPlexonServiceSecret());
  return {
    plexonAuthUrlSet: urlSet,
    plexonServiceSecretSet: secretSet,
    plexonAuthActive: urlSet && secretSet,
  };
}

export type PlexonAuthUser = { id: string; email: string; name?: string };

export type PlexonCredentialValidation =
  | { ok: true; user: PlexonAuthUser }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "network_error"; message: string }
  | { ok: false; reason: "service_secret_mismatch" }
  | { ok: false; reason: "invalid_credentials" }
  | { ok: false; reason: "plexon_unexpected_status"; status: number; message: string };

/**
 * Validiert E-Mail/Passwort gegen PLEXON (`POST …/api/auth/validate-credentials`).
 * Liefert strukturiertes Ergebnis, damit die Login-Route nicht fälschlich den lokalen Backend-Login mit dem PLEXON-Klartext-Passwort versucht.
 */
export async function validatePlexonCredentials(email: string, password: string): Promise<PlexonCredentialValidation> {
  const base = getPlexonAuthUrl();
  const secret = getPlexonServiceSecret();
  if (!base || !secret) {
    return { ok: false, reason: "not_configured" };
  }
  const url = `${base.replace(/\/$/, "")}/api/auth/validate-credentials`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getPlexonContractHeaders(secret),
      },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    console.error("[AUDION] PLEXON auth error:", e);
    return { ok: false, reason: "network_error", message };
  }

  const text = await res.text();
  let errorBody = "";
  try {
    const j = JSON.parse(text) as { error?: unknown };
    if (typeof j.error === "string") errorBody = j.error;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    if (res.status === 401 && errorBody === "Unauthorized") {
      return { ok: false, reason: "service_secret_mismatch" };
    }
    if (res.status === 401) {
      return { ok: false, reason: "invalid_credentials" };
    }
    return {
      ok: false,
      reason: "plexon_unexpected_status",
      status: res.status,
      message: errorBody || text.slice(0, 200),
    };
  }

  try {
    const data = JSON.parse(text) as { user?: PlexonAuthUser };
    const user = data?.user;
    if (user?.id && user.email) {
      return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
    }
  } catch {
    /* fall through */
  }
  return {
    ok: false,
    reason: "plexon_unexpected_status",
    status: res.status,
    message: "missing user in PLEXON response",
  };
}

/**
 * Deterministisches Passwort für einen PLEXON-User, damit das Persona-Backend
 * ohne Anpassung genutzt werden kann: zuerst Login, bei 401 Register mit diesem Passwort.
 */
export function getPlexonDerivedPassword(plexonUserId: string): string {
  return createHmac("sha256", getPlexonServiceSecret())
    .update(plexonUserId)
    .digest("base64url")
    .slice(0, 32);
}

/**
 * Anzeigename fürs Persona-Backend bei PLEXON-Login: muss nie `undefined` sein,
 * sonst sendet `loginWithBackend` bei 401 keinen Register-Versuch (und bestehende
 * Nutzer landen nicht im 409 → plexon-sync Pfad).
 */
export function plexonUserDisplayNameForAudion(plexonName: string | undefined, normalizedEmail: string): string {
  const fromPlexon = typeof plexonName === "string" ? plexonName.trim() : "";
  if (fromPlexon) return fromPlexon;
  const local = normalizedEmail.split("@")[0]?.trim();
  if (local) return local;
  return "User";
}

export type PlexonProfile = {
  id: string;
  email: string;
  name?: string;
  company?: string;
  avatar_url?: string;
  locale?: string;
};

export async function getPlexonProfile(userId: string): Promise<PlexonProfile | null> {
  const authUrl = getPlexonAuthUrl();
  const secret = getPlexonServiceSecret();
  if (!authUrl || !secret) return null;
  const base = authUrl.replace(/\/$/, "");
  try {
    const res = await fetch(
      `${base}/api/services/profile?user_id=${encodeURIComponent(userId)}`,
      { headers: getPlexonContractHeaders(secret) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: PlexonProfile };
    return data?.user ?? null;
  } catch (e) {
    console.error("[AUDION] PLEXON getProfile error:", e);
    return null;
  }
}

/** PLEXON-Profil per E-Mail holen (Fallback wenn Backend noch kein plexon_user_id hat). */
export async function getPlexonProfileByEmail(email: string): Promise<PlexonProfile | null> {
  const authUrl = getPlexonAuthUrl();
  const secret = getPlexonServiceSecret();
  if (!authUrl || !secret) return null;
  const base = authUrl.replace(/\/$/, "");
  const normalized = email?.trim()?.toLowerCase();
  if (!normalized) return null;
  try {
    const res = await fetch(
      `${base}/api/services/profile?email=${encodeURIComponent(normalized)}`,
      { headers: getPlexonContractHeaders(secret) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: PlexonProfile };
    return data?.user ?? null;
  } catch (e) {
    console.error("[AUDION] PLEXON getProfileByEmail error:", e);
    return null;
  }
}

export async function patchPlexonProfile(
  userId: string,
  updates: {
    name?: string | null;
    email?: string;
    company?: string | null;
    avatar_url?: string | null;
    locale?: string | null;
  }
): Promise<PlexonProfile | null> {
  const authUrl = getPlexonAuthUrl();
  const secret = getPlexonServiceSecret();
  if (!authUrl || !secret) return null;
  const base = authUrl.replace(/\/$/, "");
  const body: Record<string, unknown> = { user_id: userId };
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.email !== undefined) body.email = updates.email;
  if (updates.company !== undefined) body.company = updates.company;
  if (updates.avatar_url !== undefined) body.avatar_url = updates.avatar_url;
  if (updates.locale !== undefined) body.locale = updates.locale;
  try {
    const res = await fetch(`${base}/api/services/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getPlexonContractHeaders(secret),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: PlexonProfile };
    return data?.user ?? null;
  } catch (e) {
    console.error("[AUDION] PLEXON patchProfile error:", e);
    return null;
  }
}
