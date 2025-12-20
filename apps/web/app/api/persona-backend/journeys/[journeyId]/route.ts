import { NextResponse } from "next/server";
import { getPersonaBackendBase } from "../../../_lib/backend";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  try {
    const { journeyId } = await params;
    const personaBackendBase = getPersonaBackendBase({ preferPublic: false });
    console.log("[api/persona-backend/journeys/[journeyId]] Fetching journey:", journeyId);
    
    const url = `${personaBackendBase}/journeys/${journeyId}`;
    console.log("[api/persona-backend/journeys/[journeyId]] Fetching from:", url);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
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
    console.error("[api/persona-backend/journeys/[journeyId]] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch journey" },
      { status: 500 }
    );
  }
}
