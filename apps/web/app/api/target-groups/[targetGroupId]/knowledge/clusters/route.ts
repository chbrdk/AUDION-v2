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
  
  const method = searchParams.get("method") || "kmeans";
  const nClusters = searchParams.get("n_clusters") || "10";
  const minSamples = searchParams.get("min_samples") || "3";
  const limit = searchParams.get("limit") || "1000";
  
  const queryParams = new URLSearchParams({
    method,
    n_clusters: nClusters,
    min_samples: minSamples,
    limit,
  });
  
  const target = `/target-groups/${targetGroupId}/knowledge/clusters?${queryParams.toString()}`;
  return forwardPersonaBackend(target);
}

