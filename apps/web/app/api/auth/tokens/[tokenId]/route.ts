import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../_lib/auth";

function personaBackend503(message: string, target: string): NextResponse {
  return NextResponse.json(
    {
      error: "Persona backend unreachable",
      detail: message,
    },
    { status: 503 }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { tokenId } = await params;
  const target = `${getPersonaBackendBase({ preferPublic: false })}/auth/tokens/${encodeURIComponent(tokenId)}`;
  try {
    const response = await fetch(target, {
      method: "DELETE",
      headers: buildAuthHeaders(token),
    });
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const dataText = await response.text();
    return new NextResponse(dataText, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    return personaBackend503(message, target);
  }
}
