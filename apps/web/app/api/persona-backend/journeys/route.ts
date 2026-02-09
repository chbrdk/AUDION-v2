import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPersonaBackendBase } from "../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../_lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Use internal URL for server-side requests
    const personaBackendBase = getPersonaBackendBase({ preferPublic: false });
    console.log("[api/persona-backend/journeys] Using persona backend base:", personaBackendBase);
    
    const url = `${personaBackendBase}/journeys`;
    console.log("[api/persona-backend/journeys] Fetching from:", url);
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
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/persona-backend/journeys] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch journeys" },
      { status: 500 }
    );
  }
}
