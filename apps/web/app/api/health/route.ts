import { NextResponse } from "next/server";

/**
 * Health check endpoint for Docker health checks
 * Returns 200 OK if the service is running
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "web", timestamp: new Date().toISOString() },
    { status: 200 }
  );
}

// Disable static generation to ensure this is always dynamic
export const dynamic = "force-dynamic";
