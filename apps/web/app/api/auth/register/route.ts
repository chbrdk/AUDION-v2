import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";
import { AUTH_COOKIE_NAME, PROJECT_COOKIE_NAME } from "../../../../lib/auth-constants";
import { enrichAudionUserWithPlexonProfile } from "../../../../lib/plexon-auth";

const buildCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
});

export async function POST(request: Request) {
  const payload = await request.text();
  const response = await fetch(`${getPersonaBackendBase({ preferPublic: false })}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: payload,
  });

  const dataText = await response.text();
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
