export const dynamic = "force-dynamic";

import { getServerAuthToken } from "../../api/_lib/auth";
import { getPersonaBackendBase } from "../../api/_lib/backend";
import { MsqdxGlassProjectsOverview } from "../../../components/projects/msqdx-glass-projects-overview";
import type { ProjectSummary } from "../../../components/projects/project-provider";

async function fetchProjectsList(headers: HeadersInit): Promise<ProjectSummary[]> {
  try {
    const apiUrl = `${getPersonaBackendBase({ preferPublic: false })}/projects`;
    const response = await fetch(apiUrl, {
      cache: "no-store",
      headers,
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

export default async function AdminProjectsOverviewPage() {
  const authToken = await getServerAuthToken();
  const headers: HeadersInit = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const projects = await fetchProjectsList(headers);

  return <MsqdxGlassProjectsOverview initialProjects={projects} />;
}
