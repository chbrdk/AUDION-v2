import { NextRequest, NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../_lib/auth";

export async function GET(request: NextRequest) {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return new NextResponse(JSON.stringify({ detail: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const response = await fetch(`${getPersonaBackendBase({ preferPublic: false })}/auth/me`, {
    headers: {
      ...buildAuthHeaders(token),
    },
    cache: "no-store",
  });

  const dataText = await response.text();
  return new NextResponse(dataText, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}
