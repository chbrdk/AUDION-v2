import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../_lib/auth";

export async function POST(request: NextRequest) {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return new NextResponse(JSON.stringify({ detail: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.text();
  const response = await fetch(`${getPersonaBackendBase({ preferPublic: false })}/auth/password`, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      ...buildAuthHeaders(token),
    },
    body: payload,
  });

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const dataText = await response.text();
  return new NextResponse(dataText, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}
