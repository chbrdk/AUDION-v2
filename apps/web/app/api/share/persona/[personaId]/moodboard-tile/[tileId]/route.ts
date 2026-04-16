import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../../../_lib/backend";

type PersonaContext = { params: { personaId?: string; tileId?: string } } | { params: Promise<{ personaId?: string; tileId?: string }> };

const resolveParams = async (context: PersonaContext) => {
  const ctxParams = "then" in context.params ? await context.params : context.params;
  return { personaId: ctxParams?.personaId, tileId: ctxParams?.tileId };
};

export async function GET(request: NextRequest, context: PersonaContext) {
  const { personaId, tileId } = await resolveParams(context);
  if (!personaId || personaId === "undefined") {
    return NextResponse.json({ error: "Persona ID missing" }, { status: 400 });
  }
  if (!tileId || tileId === "undefined") {
    return NextResponse.json({ error: "Tile ID missing" }, { status: 400 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const base = getPersonaBackendBase();
  const target = `${base}/personas/${personaId}/moodboard-tiles/${tileId}/image?project_id=${encodeURIComponent(projectId)}`;

  const upstream = await fetch(target, { cache: "no-store", method: "GET" });
  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
