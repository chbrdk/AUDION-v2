import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

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

  const target = `${getPersonaBackendBase({ preferPublic: false })}/auth/me`;
  let response: Response;
  try {
    response = await fetch(target, {
      headers: {
        ...buildAuthHeaders(token),
      },
      cache: "no-store",
    });
  } catch (error) {
    // Avoid crashing next start with unhandled ECONNREFUSED etc.
    const message = error instanceof Error ? error.message : "fetch failed";
    return NextResponse.json(
      { error: "Persona backend unreachable", detail: message, target },
      { status: 503 }
    );
  }

  const dataText = await response.text();
  return new NextResponse(dataText, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}

export async function PATCH(request: NextRequest) {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return new NextResponse(JSON.stringify({ detail: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.text();
  const target = `${getPersonaBackendBase({ preferPublic: false })}/auth/me`;
  let response: Response;
  try {
    response = await fetch(target, {
      method: "PATCH",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
        ...buildAuthHeaders(token),
      },
      body: payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    return NextResponse.json(
      { error: "Persona backend unreachable", detail: message, target },
      { status: 503 }
    );
  }

  const dataText = await response.text();
  return new NextResponse(dataText, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}
