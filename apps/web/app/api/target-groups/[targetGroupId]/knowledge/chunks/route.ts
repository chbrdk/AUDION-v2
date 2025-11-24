import type { NextRequest } from "next/server";

import { forwardPersonaBackend, resolvePersonaParams } from "../../../../_lib/persona";

type RouteParams = {
  params: {
    targetGroupId: string;
  };
};

export async function GET(request: NextRequest, context: RouteParams) {
  const { targetGroupId } = await resolvePersonaParams(context);
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get("limit") || "1000";
  
  const target = `/target-groups/${targetGroupId}/knowledge/chunks?limit=${limit}`;
  return forwardPersonaBackend(target);
}

