import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../../../_lib/auth";

type RouteContext =
  | { params: { personaId?: string; runId?: string } }
  | { params: Promise<{ personaId?: string; runId?: string }> };

const resolveParams = async (context: RouteContext) => {
  const params = "then" in context.params ? await context.params : context.params;
  return { personaId: params?.personaId, runId: params?.runId };
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { personaId, runId } = await resolveParams(context);
  if (!personaId || personaId === "undefined" || !runId || runId === "undefined") {
    return NextResponse.json({ error: "personaId and runId required" }, { status: 400 });
  }
  const base = getPersonaBackendBase();
  const url = new URL(request.url);
  const qs = url.searchParams.toString();
  const target = `${base}/api/persona-admin/${personaId}/ux-journey-runs/${runId}/convert${qs ? `?${qs}` : ""}`;
  const token = getAuthTokenFromRequest(request);
  const body = await request.text();

  const upstream = await fetch(target, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      ...buildAuthHeaders(token),
    },
    body,
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}
