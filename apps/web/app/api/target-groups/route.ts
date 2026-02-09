import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../_lib/auth";

const buildTargetUrl = (request: NextRequest) => {
  const base = getPersonaBackendBase();
  const params = request.nextUrl.searchParams.toString();
  return `${base}/target-groups${params ? `?${params}` : ""}`;
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

export async function GET(request: NextRequest) {
  const target = buildTargetUrl(request);
  return forward(request, target);
}

export async function POST(request: NextRequest) {
  const target = `${getPersonaBackendBase()}/target-groups`;
  const body = await request.text();
  return forward(request, target, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body,
  });
}
