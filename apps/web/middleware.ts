import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "./lib/auth-constants";

const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/chat"]);
const PROTECTED_PREFIXES = ["/admin", "/upload", "/personas", "/target-groups", "/queue"];

// Paths that should allow CORS from Figma plugins (origin: null)
const CORS_API_PREFIXES = ["/api/", "/persona-backend/", "/auth/"];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "null",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const origin = request.headers.get("origin");

  // Handle CORS preflight (OPTIONS) for Figma plugin requests from "null" origin
  const isApiPath = CORS_API_PREFIXES.some((p) => pathname.startsWith(p));
  if (isApiPath && origin === "null") {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders() });
    }
    // For non-preflight requests, add CORS headers to the response
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders())) {
      response.headers.set(key, value);
    }
    return response;
  }

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
  matcher: ["/((?!_next|favicon.ico).*)"],
};

