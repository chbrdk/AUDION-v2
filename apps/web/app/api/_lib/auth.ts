import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, PROJECT_COOKIE_NAME } from "../../../lib/auth-constants";

const parseCookieValue = (cookieHeader: string | null, name: string): string | null => {
  if (!cookieHeader) return null;
  const cookiesList = cookieHeader.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookiesList) {
    if (!cookie.startsWith(`${name}=`)) continue;
    return decodeURIComponent(cookie.slice(name.length + 1));
  }
  return null;
};

export const getAuthTokenFromRequest = (request?: NextRequest): string | null => {
  // 1. Try to get from cookies first (for web app users)
  let token = request?.cookies?.get(AUTH_COOKIE_NAME)?.value ?? null;
  
  // 2. Fallback to Authorization header (for Figma plugin / API users)
  if (!token) {
    const headerToken = request?.headers?.get("authorization");
    if (headerToken?.toLowerCase().startsWith("bearer ")) {
      token = headerToken.slice(7).trim();
    }
  }

  // 3. Last resort: parse raw cookie header (for some proxy scenarios)
  if (!token) {
    token = parseCookieValue(request?.headers?.get("cookie") ?? null, AUTH_COOKIE_NAME);
  }

  return token;
};

export const getProjectIdFromRequest = (request?: NextRequest): string | null => {
  if (request?.cookies) {
    return request.cookies.get(PROJECT_COOKIE_NAME)?.value ?? null;
  }
  return parseCookieValue(request?.headers?.get("cookie") ?? null, PROJECT_COOKIE_NAME);
};

export const getServerAuthToken = async (): Promise<string | null> => {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
};

export const getServerProjectId = async (): Promise<string | null> => {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(PROJECT_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
};

export const buildAuthHeaders = (token: string | null): Record<string, string> => {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};
