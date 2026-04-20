import type { NextRequest } from "next/server";

import { getPersonaBackendBase } from "../../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const base = getPersonaBackendBase({ preferPublic: false });
  const token = getAuthTokenFromRequest(request);
  const search = request.nextUrl.searchParams.toString();
  const target = `${base}/projects/${projectId}/research/stream${search ? `?${search}` : ""}`;

  const upstream = await fetch(target, {
    method: "GET",
    cache: "no-store",
    headers: {
      ...buildAuthHeaders(token),
      Accept: "text/event-stream",
    },
  });

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("Connection", "keep-alive");
  headers.set("X-Accel-Buffering", "no");

  // Pass through useful upstream headers if present
  const upstreamCache = upstream.headers.get("cache-control");
  if (upstreamCache) headers.set("Upstream-Cache-Control", upstreamCache);

  return new Response(upstream.body, { status: upstream.status, headers });
}

