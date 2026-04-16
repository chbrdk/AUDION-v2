import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../../_lib/auth";

type Context = { params: { moodboardId?: string } } | { params: Promise<{ moodboardId?: string }> };

const resolveMoodboardId = async (context: Context): Promise<string | undefined> => {
  const ctxParams = "then" in context.params ? await context.params : context.params;
  return ctxParams?.moodboardId;
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

export async function POST(request: NextRequest, context: Context) {
  const moodboardId = await resolveMoodboardId(context);
  if (!moodboardId || moodboardId === "undefined") {
    return NextResponse.json({ error: "Moodboard ID missing" }, { status: 400 });
  }
  const base = getPersonaBackendBase();
  const target = `${base}/api/persona-admin/moodboards/${moodboardId}/rebuild`;
  return forward(request, target, { method: "POST" });
}

