import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { fetchWithTimeout, getPersonaBackendBase } from "../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../_lib/auth";
import { describePersonaUpstreamFetchError } from "../../_lib/upstream-fetch-error";

const buildTargetUrl = (request: NextRequest, path: string) => {
  const base = getPersonaBackendBase({ preferPublic: false });
  const params = request.nextUrl.searchParams.toString();
  const normalizedPath = path ? `/${path}` : "";
  return `${base}/projects${normalizedPath}${params ? `?${params}` : ""}`;
};

const forward = async (request: NextRequest, target: string) => {
  const token = getAuthTokenFromRequest(request);
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(
      target,
      {
        method: request.method,
        cache: "no-store",
        headers: {
          ...(body ? { "Content-Type": request.headers.get("content-type") ?? "application/json" } : {}),
          ...buildAuthHeaders(token),
        },
        body,
      },
      60_000
    );
  } catch (err) {
    const { message, code, hint } = describePersonaUpstreamFetchError(err);
    return NextResponse.json(
      { detail: "Bad Gateway", upstream: "persona-api", message, code, hint },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await params;
  const path = resolved.path?.join("/") ?? "";
  const target = buildTargetUrl(request, path);
  return forward(request, target);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await params;
  const path = resolved.path?.join("/") ?? "";
  const target = buildTargetUrl(request, path);
  return forward(request, target);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await params;
  const path = resolved.path?.join("/") ?? "";
  const target = buildTargetUrl(request, path);
  return forward(request, target);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await params;
  const path = resolved.path?.join("/") ?? "";
  const target = buildTargetUrl(request, path);
  return forward(request, target);
}
