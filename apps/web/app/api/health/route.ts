import { NextResponse } from "next/server";
import { getPersonaBackendEnvSnapshot } from "../_lib/backend";
import { getPlexonAuthHealthSnapshot } from "../../../lib/plexon-auth";
import { getRuntimeMetadata } from "../../../lib/runtime-metadata";

/**
 * Health check endpoint for Docker health checks
 * Returns 200 OK if the service is running
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "web",
      timestamp: new Date().toISOString(),
      ...getRuntimeMetadata(),
      auth: {
        ...getPlexonAuthHealthSnapshot(),
        ...getPersonaBackendEnvSnapshot(),
      },
    },
    { status: 200 }
  );
}

// Disable static generation to ensure this is always dynamic
export const dynamic = "force-dynamic";
