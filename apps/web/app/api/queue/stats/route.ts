import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../_lib/auth";

const forward = async (request: NextRequest, target: string) => {
  const token = getAuthTokenFromRequest(request);
  const upstream = await fetch(target, {
    cache: "no-store",
    headers: {
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

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams.toString();
  const target = `${getPersonaBackendBase()}/queue/stats${params ? `?${params}` : ""}`;
  return forward(request, target);
}
