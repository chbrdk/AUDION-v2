export const dynamic = "force-dynamic";

import type { PersonaListResponse } from "@msqdx-glass/types";

import { getPersonaBackendBase, getPersonaBackendDocsUrl } from "../../api/_lib/backend";
import { buildAuthHeaders, getServerAuthToken, getServerProjectId } from "../../api/_lib/auth";
import { MsqdxGlassPersonaAdminPanel } from "../../../components/msqdx-glass-persona-admin-panel";

async function fetchPersonaList(projectId: string, headers: HeadersInit): Promise<PersonaListResponse> {
  const base = getPersonaBackendBase({ preferPublic: false });
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(`${base}/personas?page=1&page_size=50&project_id=${projectId}`, {
      cache: "no-store",
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Persona backend unavailable (${response.status}): ${detail}`);
    }

    return (await response.json()) as PersonaListResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Persona backend request timeout: ${base}`);
    }
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      throw new Error(`Persona backend unreachable at ${base}. Is the service running?`);
    }
    throw error;
  }
}

export default async function PersonaAdminPage() {
  let list: PersonaListResponse;
  let error: string | null = null;
  const projectId = await getServerProjectId();
  const headers = buildAuthHeaders(await getServerAuthToken());
  
  try {
    if (!projectId) {
      throw new Error("Select a project to load personas.");
    }
    list = await fetchPersonaList(projectId, headers);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
    list = { items: [], total: 0, page: 1, page_size: 50 };
  }

  const docsUrl = getPersonaBackendDocsUrl();

  return (
    <>
      {error && (
        <div style={{ padding: "1rem", marginBottom: "1rem", backgroundColor: "var(--color-secondary-dx-pink-tint)", borderRadius: "8px", color: "var(--color-secondary-dx-pink-on-light)" }}>
          <strong>Backend unreachable:</strong> {error}. Please wait until the service has fully started and reload the page.
        </div>
      )}
      <MsqdxGlassPersonaAdminPanel initialList={list} docsUrl={docsUrl} />
    </>
  );
}
