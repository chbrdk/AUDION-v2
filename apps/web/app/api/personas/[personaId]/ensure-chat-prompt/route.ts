import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../_lib/auth";

type RouteParams = { params: { personaId?: string } } | { params: Promise<{ personaId?: string }> };

const resolvePersonaId = async (context: RouteParams): Promise<string | undefined> => {
  const ctxParams = "then" in context.params ? await context.params : context.params;
  return ctxParams?.personaId;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const personaId = await resolvePersonaId(context);
    if (!personaId || personaId === "undefined") {
      return NextResponse.json({ error: "Persona ID missing" }, { status: 400 });
    }
    const baseUrl = getPersonaBackendBase({ preferPublic: false });
    const target = `${baseUrl}/personas/${personaId}/ensure-chat-prompt`;
    const token = getAuthTokenFromRequest(request);

    const response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(token),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    const contentType = response.headers.get("content-type") ?? "application/json";
    const responseBody = await response.text();

    if (!response.ok) {
      try {
        return NextResponse.json(JSON.parse(responseBody), { status: response.status });
      } catch {
        return NextResponse.json({ detail: responseBody }, { status: response.status });
      }
    }

    return new NextResponse(responseBody, {
      status: response.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    console.error("[api/personas/ensure-chat-prompt] POST failed:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (error instanceof Error && (message.includes("timeout") || error.name === "AbortError")) {
      return NextResponse.json({ error: "Request timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
