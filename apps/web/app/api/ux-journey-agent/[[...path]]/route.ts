import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { fetchWithTimeout, getPersonaBackendBase } from "../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../_lib/auth";
import { describePersonaUpstreamFetchError } from "../../_lib/upstream-fetch-error";

const buildTargetUrl = (request: NextRequest, path: string) => {
  const base = getPersonaBackendBase({ preferPublic: false });
  const params = request.nextUrl.searchParams.toString();
  const normalizedPath = path ? `/${path}` : "";
  return `${base}/ux-journey-agent${normalizedPath}${params ? `?${params}` : ""}`;
};

const resolvePath = (params: { path?: string[] }) => params.path?.join("/") ?? "";

const shouldStreamResponse = (path: string) =>
  path.endsWith("/live/stream") || path.endsWith("/video");

const forward = async (request: NextRequest, target: string, opts: { stream: boolean }) => {
  const { stream } = opts;
  const token = getAuthTokenFromRequest(request);
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
  const range = request.headers.get("range") ?? undefined;
  const ifRange = request.headers.get("if-range") ?? undefined;

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
          ...(stream ? { Accept: request.headers.get("accept") ?? "*/*" } : {}),
          ...(range ? { Range: range } : {}),
          ...(ifRange ? { "If-Range": ifRange } : {}),
        },
        body,
      },
      // Live/video may take longer than JSON endpoints.
      stream ? 5 * 60_000 : 60_000
    );
  } catch (err) {
    const { message, code, hint } = describePersonaUpstreamFetchError(err);
    return NextResponse.json(
      { detail: "Bad Gateway", upstream: "persona-api", message, code, hint },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

  if (stream) {
    const passthrough: Record<string, string> = {};
    for (const k of ["accept-ranges", "content-range", "content-length", "etag", "last-modified"]) {
      const v = upstream.headers.get(k);
      if (v) passthrough[k] = v;
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        ...passthrough,
      },
    });
  }

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await params;
  const path = resolvePath(resolved);
  const target = buildTargetUrl(request, path);
  return forward(request, target, { stream: shouldStreamResponse(path) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const resolved = await params;
  const path = resolvePath(resolved);
  const target = buildTargetUrl(request, path);
  return forward(request, target, { stream: shouldStreamResponse(path) });
}

