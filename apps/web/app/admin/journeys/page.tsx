export const dynamic = "force-dynamic";

import type { JourneyResponse } from "../../api/_lib/journeys";
import { getPersonaBackendBase } from "../../api/_lib/backend";
import { buildAuthHeaders, getServerAuthToken, getServerProjectId } from "../../api/_lib/auth";
import { MsqdxGlassJourneysOverview } from "../../../components/journeys/msqdx-glass-journeys-overview";

async function fetchJourneys(projectId: string | null, headers: HeadersInit): Promise<JourneyResponse[]> {
  const base = getPersonaBackendBase({ preferPublic: false });
  const params = new URLSearchParams({ page: "1", page_size: "50" });
  if (projectId) params.set("project_id", projectId);
  const apiUrl = `${base}/journeys?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(apiUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Journey backend unavailable (${response.status}): ${detail}`);
    }

    return (await response.json()) as JourneyResponse[];
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Journey backend request timeout: ${apiUrl}`);
    }
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      throw new Error(`Journey backend unreachable at ${apiUrl}. Is the service running?`);
    }
    throw error;
  }
}

export default async function JourneysListPage() {
  const projectId = await getServerProjectId();
  const headers = buildAuthHeaders(await getServerAuthToken());

  let journeys: JourneyResponse[] = [];
  try {
    journeys = await fetchJourneys(projectId, headers);
  } catch {
    journeys = [];
  }

  return <MsqdxGlassJourneysOverview initialJourneys={journeys} />;
}

