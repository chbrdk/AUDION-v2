import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../../../_lib/auth";
import { resolvePersonaParams } from "../../../../_lib/persona";

type RouteParams = {
  params: {
    targetGroupId: string;
  };
};

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const { targetGroupId } = await resolvePersonaParams(context);
    const baseUrl = getPersonaBackendBase({ preferPublic: false });
    const target = `${baseUrl}/target-groups/${targetGroupId}/personas/generate`;
    const token = getAuthTokenFromRequest(request);
    
    // Read the request body as JSON
    const body = await request.json();
    console.log("Forwarding persona generation request:", { targetGroupId, target, body });
    
    // Forward the body as JSON string with explicit Content-Length
    const bodyText = JSON.stringify(body);
    const bodyBytes = new TextEncoder().encode(bodyText);
    
    const headers = new Headers(buildAuthHeaders(token));
    headers.set("Content-Type", "application/json");
    headers.set("Content-Length", bodyBytes.length.toString());
    
    const upstreamInit = {
      method: "POST",
      headers,
      body: bodyText,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    };
    
    console.log("Sending request:", { url: target, bodyLength: bodyBytes.length, bodyText });
    const response = await fetch(target, upstreamInit);
    
    const contentType = response.headers.get("content-type") ?? "application/json";
    const responseBody = await response.text();
    
    if (!response.ok) {
      console.error("Backend error:", response.status, responseBody, "Target URL:", target, "Request body was:", JSON.stringify(body));
      try {
        const errorJson = JSON.parse(responseBody);
        return NextResponse.json(errorJson, { status: response.status });
      } catch {
        return NextResponse.json(
          { detail: responseBody || "Persona generation failed" },
          { status: response.status }
        );
      }
    }
    
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("Error in persona generation route:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === "AbortError" || errorMessage.includes("timeout")) {
        return NextResponse.json(
          { error: "Request timeout - persona generation service may be unavailable" },
          { status: 504 }
        );
      }
      if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("connect")) {
        return NextResponse.json(
          { error: "Cannot connect to persona generation service. Please check if the service is running." },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
