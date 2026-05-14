import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";
import { AUTH_COOKIE_NAME, PROJECT_COOKIE_NAME } from "../../../../lib/auth-constants";
import {
  isPlexonAuthConfigured,
  validatePlexonCredentials,
  getPlexonDerivedPassword,
  getPlexonServiceSecret,
  plexonUserDisplayNameForAudion,
  enrichAudionUserWithPlexonProfile,
  type PlexonAuthUser,
} from "../../../../lib/plexon-auth";

function safeUrlOrigin(url: string): string {
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `http://${url}`;
    return new URL(normalized).origin;
  } catch {
    return "(invalid-url)";
  }
}

const buildCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
});

async function loginWithBackend(body: { email: string; password: string; name?: string; plexon_user_id?: string }) {
  const base = getPersonaBackendBase({ preferPublic: false });
  let loginRes: Response;
  try {
    loginRes = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Backend unreachable";
    console.error("[AUDION] auth/login backend request failed:", msg);
    return new Response(
      JSON.stringify({
        detail: "Authentication service unavailable",
        error: msg,
        hint: "Set NEXT_PERSONA_BACKEND_INTERNAL_URL (or NEXT_PUBLIC_PERSONA_BACKEND_URL) in the web app so it can reach the API. See knowledge/troubleshooting-503-auth-me.md",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  if (loginRes.ok) {
    return loginRes;
  }
  // Bei PLEXON-Login: wenn User noch nicht im Backend existiert, Register versuchen
  if (body.name !== undefined && loginRes.status === 401) {
    const registerPayload: Record<string, unknown> = {
      email: body.email,
      password: body.password,
      name: body.name,
    };
    if (body.plexon_user_id) registerPayload.plexon_user_id = body.plexon_user_id;
    let regRes: Response;
    try {
      regRes = await fetch(`${base}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerPayload),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Backend unreachable";
      console.error("[AUDION] auth/register backend request failed:", msg);
      return new Response(
        JSON.stringify({
          detail: "Authentication service unavailable",
          error: msg,
          hint: "Set NEXT_PERSONA_BACKEND_INTERNAL_URL (or NEXT_PUBLIC_PERSONA_BACKEND_URL) in the web app so it can reach the API. See knowledge/troubleshooting-503-auth-me.md",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    if (regRes.ok) return regRes;
    // Register fehlgeschlagen: echte Backend-Antwort zurückgeben (nicht 401 maskieren)
    return regRes;
  }
  return loginRes;
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ detail: "Email and password required" }, { status: 400 });
  }

  let backendBody: { email: string; password: string; name?: string; plexon_user_id?: string } = { email, password };
  let plexonUser: PlexonAuthUser | null = null;

  const personaBase = getPersonaBackendBase({ preferPublic: false });
  console.warn("[AUDION] auth/login: personaBackend=", safeUrlOrigin(personaBase), "plexonConfigured=", isPlexonAuthConfigured());

  if (isPlexonAuthConfigured()) {
    const plexon = await validatePlexonCredentials(email, password);
    if (plexon.ok) {
      plexonUser = plexon.user;
      const derivedPassword = getPlexonDerivedPassword(plexon.user.id);
      backendBody = {
        email: plexon.user.email,
        password: derivedPassword,
        name: plexonUserDisplayNameForAudion(plexon.user.name, email),
        plexon_user_id: plexon.user.id,
      };
    } else if (plexon.reason === "service_secret_mismatch") {
      return NextResponse.json(
        {
          detail:
            "PLEXON hat den Service-Aufruf abgelehnt (Unauthorized). PLEXON_SERVICE_SECRET in der AUDION-Web-App muss identisch zu PLEXON und zum AUDION-API-Container sein.",
          code: "plexon_service_secret",
        },
        { status: 503 }
      );
    } else if (plexon.reason === "invalid_credentials") {
      return NextResponse.json(
        { detail: "E-Mail oder Passwort stimmen nicht mit dem PLEXON-Konto überein.", code: "plexon_invalid_credentials" },
        { status: 401 }
      );
    } else if (plexon.reason === "network_error") {
      return NextResponse.json(
        {
          detail: "PLEXON ist unter PLEXON_AUTH_URL nicht erreichbar.",
          error: plexon.message,
          code: "plexon_unreachable",
        },
        { status: 503 }
      );
    } else if (plexon.reason === "plexon_unexpected_status") {
      return NextResponse.json(
        {
          detail: "Unerwartete Antwort von PLEXON beim Login.",
          status: plexon.status,
          error: plexon.message,
          code: "plexon_unexpected",
        },
        { status: 502 }
      );
    }
    /* reason === "not_configured" should not happen when isPlexonAuthConfigured(); fall through to local login */
  }

  const response = await loginWithBackend(backendBody);
  const dataText = await response.text();

  // 409 = Email already registered (User existiert im Backend mit anderem Passwort). PLEXON-Sync: Passwort auf abgeleitetes umstellen.
  if (response.status === 409 && plexonUser) {
    const base = getPersonaBackendBase({ preferPublic: false });
    const secret = getPlexonServiceSecret();
    const syncDisplayName = plexonUserDisplayNameForAudion(plexonUser.name, email);
    try {
      const syncRes = await fetch(`${base}/auth/plexon-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": secret,
        },
        body: JSON.stringify({
          plexon_user_id: plexonUser.id,
          email: plexonUser.email,
          name: syncDisplayName,
        }),
      });
      const syncText = await syncRes.text();
      if (syncRes.ok) {
        const data = JSON.parse(syncText);
        if (data.user && typeof data.user === "object") {
          data.user = await enrichAudionUserWithPlexonProfile(data.user as Record<string, unknown>);
        }
        const next = NextResponse.json({
          user: data.user,
          default_project_id: data.default_project_id,
          access_token: data.access_token,
        });
        if (data.access_token) {
          next.cookies.set(AUTH_COOKIE_NAME, data.access_token, buildCookieOptions());
        }
        if (data.default_project_id) {
          next.cookies.set(PROJECT_COOKIE_NAME, data.default_project_id, {
            ...buildCookieOptions(),
            httpOnly: false,
          });
        }
        return next;
      }
      return new NextResponse(syncText, {
        status: syncRes.status,
        headers: { "Content-Type": syncRes.headers.get("content-type") ?? "application/json" },
      });
    } catch (err) {
      console.error("[AUDION] auth/plexon-sync failed:", err);
      return NextResponse.json(
        { detail: "Could not link account to PLEXON", error: err instanceof Error ? err.message : "Unknown error" },
        { status: 503 }
      );
    }
  }

  if (!response.ok) {
    return new NextResponse(dataText, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  }

  const data = JSON.parse(dataText);
  if (data.user && typeof data.user === "object") {
    data.user = await enrichAudionUserWithPlexonProfile(data.user as Record<string, unknown>);
  }
  const next = NextResponse.json({
    user: data.user,
    default_project_id: data.default_project_id,
    access_token: data.access_token,
  });

  if (data.access_token) {
    next.cookies.set(AUTH_COOKIE_NAME, data.access_token, buildCookieOptions());
  }
  if (data.default_project_id) {
    next.cookies.set(PROJECT_COOKIE_NAME, data.default_project_id, {
      ...buildCookieOptions(),
      httpOnly: false,
    });
  }

  return next;
}
