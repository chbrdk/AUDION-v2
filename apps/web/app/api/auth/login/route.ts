import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";
import { AUTH_COOKIE_NAME, PROJECT_COOKIE_NAME } from "../../../../lib/auth-constants";
import {
  isPlexonAuthConfigured,
  validateCredentialsWithPlexon,
  getPlexonDerivedPassword,
} from "../../../../lib/plexon-auth";

const buildCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
});

async function loginWithBackend(body: { email: string; password: string; name?: string }) {
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
      JSON.stringify({ detail: "Authentication service unavailable", error: msg }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  if (loginRes.ok) {
    return loginRes;
  }
  // Bei PLEXON-Login: wenn User noch nicht im Backend existiert, Register versuchen
  if (body.name !== undefined && loginRes.status === 401) {
    let regRes: Response;
    try {
      regRes = await fetch(`${base}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: body.email, password: body.password, name: body.name }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Backend unreachable";
      console.error("[AUDION] auth/register backend request failed:", msg);
      return new Response(
        JSON.stringify({ detail: "Authentication service unavailable", error: msg }),
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

  let backendBody: { email: string; password: string; name?: string } = { email, password };

  if (isPlexonAuthConfigured()) {
    const plexonUser = await validateCredentialsWithPlexon(email, password);
    if (plexonUser) {
      const derivedPassword = getPlexonDerivedPassword(plexonUser.id);
      backendBody = {
        email: plexonUser.email,
        password: derivedPassword,
        name: plexonUser.name,
      };
    }
  }

  const response = await loginWithBackend(backendBody);
  const dataText = await response.text();
  if (!response.ok) {
    return new NextResponse(dataText, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  }

  const data = JSON.parse(dataText);
  const next = NextResponse.json({
    user: data.user,
    default_project_id: data.default_project_id,
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
