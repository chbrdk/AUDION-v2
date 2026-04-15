export const dynamic = "force-dynamic";

import type { PersonaListResponse, TargetGroupListResponse } from "@msqdx-glass/types";
import { MsqdxGlassAdminDashboard } from "../../components/admin/msqdx-glass-admin-dashboard";
import { normalizePersonaListResponse } from "../../lib/persona-list-normalize";
import { getPersonaBackendBase } from "../api/_lib/backend";
import { buildAuthHeaders, getServerAuthToken, getServerProjectId } from "../api/_lib/auth";

const DASHBOARD_PAGE_SIZE = 6;

async function fetchPersonaList(projectId: string | null, headers: HeadersInit): Promise<PersonaListResponse> {
  const params = new URLSearchParams({ page: "1", page_size: String(DASHBOARD_PAGE_SIZE) });
  if (projectId) params.set("project_id", projectId);
  const apiUrl = `${getPersonaBackendBase({ preferPublic: false })}/personas?${params.toString()}`;

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
      throw new Error(`Persona backend unavailable (${response.status}): ${detail}`);
    }

    return normalizePersonaListResponse(await response.json());
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Persona backend request timeout: ${apiUrl}`);
    }
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      throw new Error(`Persona backend unreachable at ${apiUrl}. Is the service running?`);
    }
    throw error;
  }
}

async function fetchTargetGroupList(projectId: string | null, headers: HeadersInit): Promise<TargetGroupListResponse> {
  const params = new URLSearchParams({ page: "1", page_size: String(DASHBOARD_PAGE_SIZE) });
  if (projectId) params.set("project_id", projectId);
  const apiUrl = `${getPersonaBackendBase({ preferPublic: false })}/target-groups?${params.toString()}`;

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
      throw new Error(`Target Group backend unavailable (${response.status}): ${detail}`);
    }

    return (await response.json()) as TargetGroupListResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Target Group backend request timeout: ${apiUrl}`);
    }
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      throw new Error(`Target Group backend unreachable at ${apiUrl}. Is the service running?`);
    }
    throw error;
  }
}

export default async function AdminDashboardPage() {
  let personaData: PersonaListResponse = { items: [], total: 0, page: 1, page_size: DASHBOARD_PAGE_SIZE };
  let targetGroupData: TargetGroupListResponse = { items: [], total: 0, page: 1, page_size: DASHBOARD_PAGE_SIZE };
  let error: string | null = null;
  const projectId = await getServerProjectId();
  const headers = buildAuthHeaders(await getServerAuthToken());

  try {
    // When no project is selected, we still show a global preview (unfiltered).
    const [personaResponse, targetGroupResponse] = await Promise.allSettled([
      fetchPersonaList(projectId, headers),
      fetchTargetGroupList(projectId, headers),
    ]);

    if (personaResponse.status === "fulfilled") {
      personaData = personaResponse.value;
    } else {
      console.error("Failed to fetch personas:", personaResponse.reason);
      error = "Failed to load personas.";
    }

    if (targetGroupResponse.status === "fulfilled") {
      targetGroupData = targetGroupResponse.value;
    } else {
      console.error("Failed to fetch target groups:", targetGroupResponse.reason);
      error = error ?? "Failed to load target groups.";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <>
      {error && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            backgroundColor: "var(--color-secondary-dx-pink-tint)",
            borderRadius: "8px",
            color: "var(--color-secondary-dx-pink-on-light)",
          }}
        >
          <strong>Backend error:</strong> {error} Please reload the page.
        </div>
      )}
      <MsqdxGlassAdminDashboard
        personaItems={personaData.items}
        personaTotal={personaData.total}
        targetGroupItems={targetGroupData.items}
        targetGroupTotal={targetGroupData.total}
      />
    </>
  );
}
