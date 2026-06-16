import { NextResponse } from "next/server";
import { getPersonaBackendEnvSnapshot } from "../_lib/backend";
import { getPlexonAuthHealthSnapshot } from "../../../lib/plexon-auth";
import { probePersonaBackendHealth } from "../../../lib/persona-backend-health";
import { getRuntimeMetadata } from "../../../lib/runtime-metadata";

/**
 * Health check endpoint for Docker health checks.
 * Also probes whether the web app can reach the FastAPI persona backend.
 */
export async function GET() {
  const personaBackend = await probePersonaBackendHealth();
  const degraded = !personaBackend.personaBackendReachable;

  return NextResponse.json(
    {
      status: degraded ? "degraded" : "ok",
      service: "web",
      timestamp: new Date().toISOString(),
      ...getRuntimeMetadata(),
      auth: {
        ...getPlexonAuthHealthSnapshot(),
        ...getPersonaBackendEnvSnapshot(),
      },
      personaBackend,
    },
    // Keep 200 so Docker/Coolify healthchecks do not fail when only the API backend is down.
    { status: 200 }
  );
}

// Disable static generation to ensure this is always dynamic
export const dynamic = "force-dynamic";
