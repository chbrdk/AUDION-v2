import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";
import { AUTH_COOKIE_NAME, PROJECT_COOKIE_NAME } from "../../../../lib/auth-constants";
import {
  enrichAudionUserWithPlexonProfile,
  getPlexonDerivedPassword,
  isPlexonAuthConfigured,
  plexonUserDisplayNameForAudion,
  registerUserAtPlexon,
} from "../../../../lib/plexon-auth";

const buildCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
});

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "application/json";
  const payloadText = await request.text();
  const personaBase = getPersonaBackendBase({ preferPublic: false });
  let bodyToPersona = payloadText;

  if (isPlexonAuthConfigured()) {
    let raw: { email?: string; password?: string; name?: string };
    try {
      raw = JSON.parse(payloadText) as typeof raw;
    } catch {
      return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
    }
    const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
    const password = typeof raw.password === "string" ? raw.password : "";
    const name = typeof raw.name === "string" ? raw.name : undefined;
    if (!email || !password) {
      return NextResponse.json({ detail: "Email and password required" }, { status: 400 });
    }
    const pr = await registerUserAtPlexon({ email, password, name: name ?? null });
    if (!pr.ok) {
      return new NextResponse(JSON.stringify({ detail: pr.error }), {
        status: pr.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    const derived = getPlexonDerivedPassword(pr.userId);
    bodyToPersona = JSON.stringify({
      email,
      password: derived,
      name: plexonUserDisplayNameForAudion(name, email),
      plexon_user_id: pr.userId,
    });
  }

  const response = await fetch(`${personaBase}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: bodyToPersona,
  });

  const dataText = await response.text();
  if (!response.ok) {
    return new NextResponse(dataText, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  }

  let data: { user?: unknown; access_token?: string; default_project_id?: string };
  try {
    data = JSON.parse(dataText) as typeof data;
  } catch {
    return NextResponse.json({ detail: "Invalid response from authentication service" }, { status: 502 });
  }
  if (data.user && typeof data.user === "object") {
    data.user = await enrichAudionUserWithPlexonProfile(data.user as Record<string, unknown>);
  }
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
