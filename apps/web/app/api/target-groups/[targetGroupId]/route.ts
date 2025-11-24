import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";

type RouteParams = {
  params: {
    targetGroupId: string;
  };
};

const forward = async (target: string, init?: RequestInit) => {
  const upstream = await fetch(target, {
    cache: "no-store",
    ...init,
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
  return forward(target);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { targetGroupId } = await params;
  const target = `${getPersonaBackendBase()}/target-groups/${targetGroupId}`;
  const body = await request.text();
  return forward(target, {
    method: "PATCH",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body,
  });
}

