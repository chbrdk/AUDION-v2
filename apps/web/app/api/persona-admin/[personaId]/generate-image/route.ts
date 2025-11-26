import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { PersonaRouteContext } from "../../../_lib/persona";
import { resolvePersonaParams } from "../../../_lib/persona";
import { getChatApiBase } from "../../../_lib/backend";

type PersonaParams = { personaId?: string };
type PersonaContext = PersonaRouteContext<PersonaParams>;

const resolvePersonaId = async (context: PersonaContext): Promise<string | undefined> => {
  const { personaId } = await resolvePersonaParams(context);
  return personaId;
};

export async function POST(_request: NextRequest, context: PersonaContext) {
  const personaId = await resolvePersonaId(context);
  if (!personaId) {
    return NextResponse.json({ error: "Persona ID missing" }, { status: 400 });
  }
  const target = `${getChatApiBase()}/personas/${personaId}/generate-image`;
  const upstream = await fetch(target, { method: "POST", cache: "no-store" });
  const headers = new Headers(upstream.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
