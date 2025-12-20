import { NextResponse } from "next/server";
import { getPersonaBackendBase } from "../../../../../_lib/backend";
import type { JourneyAiGenerateRequest } from "../../../../../_lib/journeys";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  try {
    const { journeyId } = await params;
    const personaBackendBase = getPersonaBackendBase({ preferPublic: false });
    
    const body = await request.json() as JourneyAiGenerateRequest;
    
    console.log("[api/persona-backend/journeys/[journeyId]/ai/generate] Generating AI suggestions for journey:", journeyId);
    
    const url = `${personaBackendBase}/journeys/${journeyId}/ai/generate`;
    console.log("[api/persona-backend/journeys/[journeyId]/ai/generate] Fetching from:", url);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
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
    console.error("[api/persona-backend/journeys/[journeyId]/ai/generate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate AI suggestions" },
      { status: 500 }
    );
  }
}















