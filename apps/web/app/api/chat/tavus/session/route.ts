import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../_lib/auth";

/**
 * Proxy POST /api/chat/tavus/session to Audion backend POST /api/persona-admin/tavus/session.
 * Body: { persona_id: string, conversation_name?: string }
 * Returns Tavus session config (conversation_url, conversation_id, meeting_token?, etc.)
 */
export async function POST(request: NextRequest) {
  const base = getPersonaBackendBase();
  const target = `${base}/api/persona-admin/tavus/session`;
  const token = getAuthTokenFromRequest(request);
  const body = await request.text();
  const upstream = await fetch(target, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      ...buildAuthHeaders(token),
    },
    body: body || undefined,
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
    },
  });
}
