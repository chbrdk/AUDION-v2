import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";

const buildTargetUrl = (request: NextRequest) => {
  const base = getPersonaBackendBase();
  const params = request.nextUrl.searchParams.toString();
  return `${base}/queue/jobs${params ? `?${params}` : ""}`;
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

export async function GET(request: NextRequest) {
  const target = buildTargetUrl(request);
  return forward(target);
}

export async function POST(request: NextRequest) {
  const target = `${getPersonaBackendBase()}/queue/jobs/${request.nextUrl.searchParams.get("job_id")}/retry`;
  return forward(target, {
    method: "POST",
  });
}

