import { getPersonaBackendBase } from "../app/api/_lib/backend";

export type PersonaBackendHealthSnapshot = {
  personaBackendReachable: boolean;
  personaBackendStatus: number | null;
  personaBackendAiConfigured: boolean | null;
  personaBackendError: string | null;
};

/** Server-side probe: can the Next.js app reach the FastAPI persona backend? */
export async function probePersonaBackendHealth(): Promise<PersonaBackendHealthSnapshot> {
  const base = getPersonaBackendBase({ preferPublic: false }).replace(/\/+$/, "");
  const url = `${base}/health`;

  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    if (!res.ok) {
      return {
        personaBackendReachable: false,
        personaBackendStatus: res.status,
        personaBackendAiConfigured: null,
        personaBackendError: text.slice(0, 200) || `HTTP ${res.status}`,
      };
    }
    let aiConfigured: boolean | null = null;
    try {
      const json = JSON.parse(text) as { ai_provider_configured?: boolean };
      if (typeof json.ai_provider_configured === "boolean") {
        aiConfigured = json.ai_provider_configured;
      }
    } catch {
      /* legacy health body */
    }
    return {
      personaBackendReachable: true,
      personaBackendStatus: res.status,
      personaBackendAiConfigured: aiConfigured,
      personaBackendError: null,
    };
  } catch (e) {
    return {
      personaBackendReachable: false,
      personaBackendStatus: null,
      personaBackendAiConfigured: null,
      personaBackendError: e instanceof Error ? e.message : String(e),
    };
  }
}
