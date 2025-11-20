import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getIndexingApiBase } from "../../../_lib/backend";

export const runtime = "nodejs";

type RouteParams = {
  params: {
    jobId: string;
  };
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params;
    
    // Validate jobId
    if (!jobId || jobId === "undefined" || jobId.trim() === "") {
      return NextResponse.json(
        { error: "Invalid job ID" },
        { status: 400 }
      );
    }
    
    const apiBase = getIndexingApiBase();
    const upstream = await fetch(`${apiBase}/documents/jobs/${jobId}/status`, {
      // Add timeout and better error handling
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    // If upstream returns an error, forward it
    if (!upstream.ok) {
      const errorText = await upstream.text();
      try {
        const errorJson = JSON.parse(errorText);
        return NextResponse.json(errorJson, { status: upstream.status });
      } catch {
        return NextResponse.json(
          { error: errorText || "Status check failed" },
          { status: upstream.status }
        );
      }
    }
    
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json"
      }
    });
  } catch (error) {
    console.error("Proxy status failed", error);
    const errorMessage = error instanceof Error ? error.message : "Status proxy failed";
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === "AbortError" || errorMessage.includes("timeout")) {
        return NextResponse.json(
          { error: "Request timeout - indexing service may be unavailable" },
          { status: 504 }
        );
      }
      if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("connect")) {
        return NextResponse.json(
          { error: "Cannot connect to indexing service" },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 502 }
    );
  }
}
