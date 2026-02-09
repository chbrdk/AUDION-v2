import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../_lib/auth";

type RouteParams = {
  params: {
    targetGroupId: string;
  };
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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { targetGroupId } = await params;
  const target = `${getPersonaBackendBase()}/target-groups/${targetGroupId}`;
  return forward(_request, target);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { targetGroupId } = await params;
  const target = `${getPersonaBackendBase()}/target-groups/${targetGroupId}`;
  const body = await request.text();
  return forward(request, target, {
    method: "PATCH",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body,
  });
}
