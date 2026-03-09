import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../../_lib/auth";
import { resolvePersonaParams } from "../../../../_lib/persona";

type RouteParams = {
  params: { targetGroupId: string };
};

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const { targetGroupId } = await resolvePersonaParams(context);
    const baseUrl = getPersonaBackendBase({ preferPublic: false });
    const target = `${baseUrl}/target-groups/${targetGroupId}/suggest-personas`;
    const token = getAuthTokenFromRequest(request);

    const body = await request.json().catch(() => ({}));
    const bodyText = JSON.stringify(body);

    const headers = new Headers(buildAuthHeaders(token));
    headers.set("Content-Type", "application/json");

    const response = await fetch(target, {
      method: "POST",
      headers,
      body: bodyText,
      signal: AbortSignal.timeout(60000),
    });

    const contentType = response.headers.get("content-type") ?? "application/json";
    const responseBody = await response.text();

    if (!response.ok) {
      try {
        const errorJson = JSON.parse(responseBody);
        return NextResponse.json(errorJson, { status: response.status });
      } catch {
        return NextResponse.json(
          { detail: responseBody || "Suggest personas failed" },
          { status: response.status }
        );
      }
    }

    return new NextResponse(responseBody, {
      status: response.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    console.error("Error in suggest-personas route:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (error instanceof Error && (error.name === "AbortError" || message.includes("timeout"))) {
      return NextResponse.json(
        { error: "Request timeout" },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
