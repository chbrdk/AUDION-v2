import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";

const forward = async (target: string) => {
  const upstream = await fetch(target, {
    cache: "no-store",
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

export async function GET(_request: NextRequest) {
  const target = `${getPersonaBackendBase()}/queue/stats`;
  return forward(target);
}

