import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../../_lib/auth";

type RouteParams = {
  params: {
    targetGroupId: string;
    knowledgeId: string;
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

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { targetGroupId, knowledgeId } = await params;
  const target = `${getPersonaBackendBase()}/target-groups/${targetGroupId}/knowledge/${knowledgeId}`;
  return forward(_request, target, {
    method: "DELETE",
  });
}
