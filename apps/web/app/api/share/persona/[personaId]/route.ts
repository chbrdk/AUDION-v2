import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../_lib/backend";

type PersonaContext = { params: { personaId?: string } } | { params: Promise<{ personaId?: string }> };

const resolvePersonaId = async (context: PersonaContext): Promise<string | undefined> => {
  const ctxParams = "then" in context.params ? await context.params : context.params;
  return ctxParams?.personaId;
};

/**
 * Public persona endpoint for shared chat links. No auth required.
 * Proxies to persona backend GET /personas/{id}/public?project_id=xxx
 */
export async function GET(request: NextRequest, context: PersonaContext) {
  const personaId = await resolvePersonaId(context);
  if (!personaId || personaId === "undefined") {
    return NextResponse.json({ error: "Persona ID missing" }, { status: 400 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const base = getPersonaBackendBase();
  const target = `${base}/personas/${personaId}/public?project_id=${encodeURIComponent(projectId)}`;

  try {
    const upstream = await fetch(target, { cache: "no-store" });
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    console.error("[api/share/persona] Fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to load persona" },
      { status: 502 }
    );
  }
}
