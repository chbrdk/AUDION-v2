import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../../_lib/auth";

type Context = { params: { tileId?: string } } | { params: Promise<{ tileId?: string }> };

const resolveTileId = async (context: Context): Promise<string | undefined> => {
  const ctxParams = "then" in context.params ? await context.params : context.params;
  return ctxParams?.tileId;
};

export async function GET(request: NextRequest, context: Context) {
  const tileId = await resolveTileId(context);
  if (!tileId || tileId === "undefined") {
    return NextResponse.json({ error: "Tile ID missing" }, { status: 400 });
  }

  const token = getAuthTokenFromRequest(request);
  const base = getPersonaBackendBase();
  const target = `${base}/api/persona-admin/moodboard-tiles/${tileId}/image`;

  const upstream = await fetch(target, {
    cache: "no-store",
    method: "GET",
    headers: {
      ...buildAuthHeaders(token),
    },
  });

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
