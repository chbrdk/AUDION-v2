import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../_lib/auth";

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

/** Proxy POST /api/persona-admin/:id/translate-fields → Audion API (bilingual field strings). */
export async function POST(request: NextRequest, context: PersonaContext) {
  const personaId = await resolvePersonaId(context);
  if (!personaId || personaId === "undefined") {
    return NextResponse.json({ detail: "Persona ID missing" }, { status: 400 });
  }
  const base = getPersonaBackendBase();
  const target = `${base}/api/persona-admin/${encodeURIComponent(personaId)}/translate-fields`;
  const body = await request.text();
  return forward(request, target, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body,
  });
}
