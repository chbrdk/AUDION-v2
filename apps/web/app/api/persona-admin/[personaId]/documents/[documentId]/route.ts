import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { PersonaRouteContext } from "../../../../_lib/persona";
import { forwardPersonaBackend, resolvePersonaParams } from "../../../../_lib/persona";

type PersonaParams = { personaId?: string; documentId?: string };
type PersonaContext = PersonaRouteContext<PersonaParams>;

export async function DELETE(_: NextRequest, context: PersonaContext) {
  const { personaId, documentId } = await resolvePersonaParams(context);
  if (!personaId || !documentId) {
    return NextResponse.json({ error: "Persona ID or Document ID missing" }, { status: 400 });
  }
  return forwardPersonaBackend(`/personas/${personaId}/documents/${documentId}`, {
    method: "DELETE",
  });
}

