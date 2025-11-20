import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getIndexingApiBase } from "../../_lib/backend";

type NodeFetchInit = RequestInit & { duplex?: "half" };

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const apiBase = getIndexingApiBase();
    const headers = new Headers(request.headers);
    headers.delete("host");

    const upstreamInit: NodeFetchInit = {
      method: "POST",
      headers,
      body: request.body,
      duplex: "half",
      // Add timeout
      signal: AbortSignal.timeout(30000), // 30 second timeout
    };
    
    const upstream = await fetch(`${apiBase}/documents/upload`, upstreamInit);

    // Handle upstream errors
    if (!upstream.ok) {
      const errorText = await upstream.text();
      try {
        const errorJson = JSON.parse(errorText);
        return NextResponse.json(errorJson, { status: upstream.status });
      } catch {
        return NextResponse.json(
          { error: errorText || "Upload failed" },
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
    console.error("Proxy upload failed", error);
    const errorMessage = error instanceof Error ? error.message : "Upload proxy failed";
    
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
          { error: "Cannot connect to indexing service. Please check if the service is running." },
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
