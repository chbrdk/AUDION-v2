import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../../_lib/backend";

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

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { targetGroupId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  const target = `${getPersonaBackendBase()}/target-groups/${targetGroupId}/personas${queryString ? `?${queryString}` : ""}`;
  return forward(target);
}
