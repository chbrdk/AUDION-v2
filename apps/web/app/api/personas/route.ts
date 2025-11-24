import { NextResponse } from "next/server";
import { getPersonaBackendBase } from "../_lib/backend";

export async function GET() {
  try {
    // Use internal URL for server-side requests
    const personaBackendBase = getPersonaBackendBase({ preferPublic: false });
    console.log("[api/personas] Using persona backend base:", personaBackendBase);
    
    const url = `${personaBackendBase}/personas`;
    console.log("[api/personas] Fetching from:", url);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
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
