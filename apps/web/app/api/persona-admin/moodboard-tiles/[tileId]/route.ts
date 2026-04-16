import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../_lib/auth";

type Context = { params: { tileId?: string } } | { params: Promise<{ tileId?: string }> };

const resolveTileId = async (context: Context): Promise<string | undefined> => {
  const ctxParams = "then" in context.params ? await context.params : context.params;
  return ctxParams?.tileId;
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

export async function PATCH(request: NextRequest, context: Context) {
  const tileId = await resolveTileId(context);
  if (!tileId || tileId === "undefined") {
    return NextResponse.json({ error: "Tile ID missing" }, { status: 400 });
  }
  const base = getPersonaBackendBase();
  const target = `${base}/api/persona-admin/moodboard-tiles/${tileId}`;
  const body = await request.text();
  return forward(request, target, {
    method: "PATCH",
    headers: { "Content-Type": request.headers.get("content-type") ?? "application/json" },
    body,
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  const tileId = await resolveTileId(context);
  if (!tileId || tileId === "undefined") {
    return NextResponse.json({ error: "Tile ID missing" }, { status: 400 });
  }
  const base = getPersonaBackendBase();
  const target = `${base}/api/persona-admin/moodboard-tiles/${tileId}`;
  return forward(request, target, { method: "DELETE" });
}

