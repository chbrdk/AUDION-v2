import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "./lib/auth-constants";

const PUBLIC_PATHS = new Set(["/", "/login", "/register"]);
const PROTECTED_PREFIXES = ["/admin", "/chat", "/upload", "/personas", "/target-groups", "/queue"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const normalizedPath =
    basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || "/" : pathname;
  const redirectTarget = normalizedPath + search;

  if (PUBLIC_PATHS.has(normalizedPath)) {
    return NextResponse.next();
  }

  if (!PROTECTED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (token) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = `${basePath}/login`;
  loginUrl.searchParams.set("redirect", redirectTarget);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
