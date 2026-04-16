import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../../_lib/auth";

type PersonaContext = { params: { personaId?: string } } | { params: Promise<{ personaId?: string }> };

const resolvePersonaId = async (context: PersonaContext): Promise<string | undefined> => {
  const ctxParams = "then" in context.params ? await context.params : context.params;
  return ctxParams?.personaId;
};

const forward = async (request: NextRequest, target: string, init?: RequestInit) => {
  const token = getAuthTokenFromRequest(request);
  const upstream = await fetch(target, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...buildAuthHeaders(token),
    },
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
    },
  });
};

export async function GET(request: NextRequest, context: PersonaContext) {
  const personaId = await resolvePersonaId(context);
  if (!personaId || personaId === "undefined") {
    return NextResponse.json({ error: "Persona ID missing" }, { status: 400 });
  }
  const base = getPersonaBackendBase();
  const target = `${base}/api/persona-admin/${personaId}/moodboards/active`;
  return forward(request, target, { method: "GET" });
}

