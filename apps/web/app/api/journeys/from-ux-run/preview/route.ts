import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../_lib/auth";

export async function POST(request: NextRequest) {
  const base = getPersonaBackendBase();
  const target = `${base}/journeys/from-ux-run/preview`;
  const token = getAuthTokenFromRequest(request);
  const body = await request.text();

  const upstream = await fetch(target, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      ...buildAuthHeaders(token),
    },
    body,
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}
