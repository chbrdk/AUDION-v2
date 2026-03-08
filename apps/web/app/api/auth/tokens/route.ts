import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../_lib/auth";

function personaBackend503(message: string, target: string): NextResponse {
  return NextResponse.json(
    {
      error: "Persona backend unreachable",
      detail: message,
    },
    { status: 503 }
  );
}

export async function GET(request: NextRequest) {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const target = `${getPersonaBackendBase({ preferPublic: false })}/auth/tokens`;
  try {
    const response = await fetch(target, {
      headers: buildAuthHeaders(token),
      cache: "no-store",
    });
    const dataText = await response.text();
    return new NextResponse(dataText, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    return personaBackend503(message, target);
  }
}

export async function POST(request: NextRequest) {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const payload = await request.text();
  const target = `${getPersonaBackendBase({ preferPublic: false })}/auth/tokens`;
  try {
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
        ...buildAuthHeaders(token),
      },
      body: payload,
    });
    const dataText = await response.text();
    return new NextResponse(dataText, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    return personaBackend503(message, target);
  }
}
