import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";

const forward = async (target: string, init?: RequestInit) => {
  const upstream = await fetch(target, {
    cache: "no-store",
    ...init,
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

const buildTarget = (personaId: string, query?: string) => {
  const base = getPersonaBackendBase();
  return `${base}/personas/${personaId}${query ? `?${query}` : ""}`;
};

type PersonaContext = { params: { personaId?: string } } | { params: Promise<{ personaId?: string }> };

const resolvePersonaId = async (context: PersonaContext): Promise<string | undefined> => {
  const ctxParams = "then" in context.params ? await context.params : context.params;
  return ctxParams?.personaId;
};

export async function GET(_: NextRequest, context: PersonaContext) {
  const personaId = await resolvePersonaId(context);
  if (!personaId || personaId === "undefined") {
    console.error("persona-admin GET without valid id", personaId);
    return NextResponse.json({ error: "Persona ID missing" }, { status: 400 });
  }
  const target = buildTarget(personaId);
  return forward(target);
}

export async function PATCH(request: NextRequest, context: PersonaContext) {
  const personaId = await resolvePersonaId(context);
  if (!personaId || personaId === "undefined") {
    console.error("persona-admin PATCH without valid id", personaId);
    return NextResponse.json({ error: "Persona ID missing" }, { status: 400 });
  }
  const target = buildTarget(personaId);
  const body = await request.text();
  return forward(target, {
    method: "PATCH",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body,
  });
}

export async function DELETE(request: NextRequest, context: PersonaContext) {
  const personaId = await resolvePersonaId(context);
  if (!personaId || personaId === "undefined") {
    console.error("persona-admin DELETE without valid id", personaId);
    return NextResponse.json({ error: "Persona ID missing" }, { status: 400 });
  }
  const urlQuery = request.nextUrl.searchParams.toString();
  const target = buildTarget(personaId, urlQuery);
  return forward(target, {
    method: "DELETE",
  });
}

