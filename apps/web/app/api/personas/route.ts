import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPersonaBackendBase } from "../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../_lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Use internal URL for server-side requests
    const personaBackendBase = getPersonaBackendBase({ preferPublic: false });
    console.log("[api/personas] Using persona backend base:", personaBackendBase);
    
    const params = request.nextUrl.searchParams.toString();
    const url = `${personaBackendBase}/personas${params ? `?${params}` : ""}`;
    console.log("[api/personas] Fetching from:", url);
    const token = getAuthTokenFromRequest(request);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(token),
      },
      cache: "no-store",
      // Add timeout to avoid hanging requests
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Persona Backend error:", response.status, errorText);
      return NextResponse.json(
        { error: `Persona Backend error: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[api/personas] Received data:", { total: data.total, itemsCount: data.items?.length || 0 });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/personas] Failed to fetch personas:", error);
    if (error instanceof Error) {
      const errorMessage = error.message || String(error);
      console.error("[api/personas] Error details:", {
        message: errorMessage,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      
      if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch failed") || errorMessage.includes("ENOTFOUND")) {
        return NextResponse.json(
          { error: `Connection refused. Cannot reach persona backend. Is it running?` },
          { status: 503 }
        );
      }
      if (errorMessage.includes("timeout") || errorMessage.includes("AbortError")) {
        return NextResponse.json(
          { error: "Request timeout. The persona backend is not responding." },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: `Failed to fetch personas: ${errorMessage}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Unknown error while fetching personas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const personaBackendBase = getPersonaBackendBase({ preferPublic: false });
    const url = `${personaBackendBase}/personas`;
    const token = getAuthTokenFromRequest(request);
    const body = await request.text();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
        ...buildAuthHeaders(token),
      },
      body: body || undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    const contentType = response.headers.get("content-type") ?? "application/json";
    const responseBody = await response.text();
    if (!response.ok) {
      try {
        return NextResponse.json(JSON.parse(responseBody), { status: response.status });
      } catch {
        return NextResponse.json({ detail: responseBody }, { status: response.status });
      }
    }
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    console.error("[api/personas] POST failed:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (error instanceof Error && (message.includes("timeout") || error.name === "AbortError")) {
      return NextResponse.json({ error: "Request timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
