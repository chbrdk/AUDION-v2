import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { PersonaRouteContext } from "../../../_lib/persona";
import { forwardPersonaBackend, resolvePersonaParams } from "../../../_lib/persona";

type PersonaParams = { personaId?: string };
type PersonaContext = PersonaRouteContext<PersonaParams>;

const resolvePersonaId = async (context: PersonaContext): Promise<string | undefined> => {
  const { personaId } = await resolvePersonaParams(context);
  return personaId;
};

export async function POST(request: NextRequest, context: PersonaContext) {
  const personaId = await resolvePersonaId(context);
  if (!personaId) {
    return NextResponse.json({ error: "Persona ID missing" }, { status: 400 });
  }
  const formData = await request.formData();
  return forwardPersonaBackend(`/personas/${personaId}/avatar`, {
    method: "POST",
    body: formData,
  });
}


