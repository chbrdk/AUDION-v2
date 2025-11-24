import type { NextRequest } from "next/server";

import { forwardPersonaBackend, resolvePersonaParams } from "../../../../../_lib/persona";

type RouteParams = {
  params: {
    targetGroupId: string;
    chunkId: string;
  };
};

export async function GET(request: NextRequest, context: RouteParams) {
  const { targetGroupId, chunkId } = await resolvePersonaParams(context);
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get("limit") || "10";
  
  const target = `/target-groups/${targetGroupId}/knowledge/chunks/${chunkId}/similar?limit=${limit}`;
  return forwardPersonaBackend(target);
}

