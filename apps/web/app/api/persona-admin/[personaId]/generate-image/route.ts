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

function jsonError(detail: string, status: number, message?: string) {
  return NextResponse.json(
    { detail: detail || "Avatar generation failed", ...(message && { message }) },
    { status }
  );
}

export async function POST(_request: NextRequest, context: PersonaContext) {
  const personaId = await resolvePersonaId(context);
  if (!personaId) {
    return NextResponse.json({ error: "Persona ID missing" }, { status: 400 });
  }

  const chatBase = getChatApiBase();
  const target = `${chatBase}/personas/${personaId}/generate-image`;

  let upstream: Response;
  try {
    upstream = await fetch(target, { method: "POST", cache: "no-store" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(
      "Chat API unreachable. Check NEXT_PUBLIC_CHAT_API_URL and that the chat-api service is running.",
      502,
      message
    );
  }

  const contentType = upstream.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!upstream.ok) {
    let detail = "Avatar generation failed";
    try {
      if (isJson) {
        const body = await upstream.json().catch(() => null);
        if (body && typeof body.detail === "string") detail = body.detail;
        else if (body && typeof body.message === "string") detail = body.message;
      } else {
        const text = await upstream.text();
        if (text) detail = text.length > 200 ? `${text.slice(0, 200)}…` : text;
      }
    } catch {
      // keep default detail
    }
    return jsonError(detail, upstream.status);
  }

  const headers = new Headers(upstream.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
