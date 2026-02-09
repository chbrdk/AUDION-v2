import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, PROJECT_COOKIE_NAME } from "../../../../lib/auth-constants";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  response.cookies.set(PROJECT_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
