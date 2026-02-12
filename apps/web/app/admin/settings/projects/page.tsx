export const dynamic = "force-dynamic";

import { getServerProjectId, getServerAuthToken } from "../../api/_lib/auth";
import { MsqdxGlassProjectAdminPanel } from "../../../components/msqdx-glass-project-admin-panel";
import { buildApiUrl } from "../../api/_lib/backend";
import type { ProjectSummary } from "../../../components/projects/project-provider";

async function fetchProjectsList(headers: HeadersInit): Promise<ProjectSummary[]> {
  try {
    const response = await fetch(buildApiUrl("/api/project/list"), {
      cache: "no-store",
      headers,
    });

    if (!response.ok) {
      console.error("Failed to fetch projects list:", response.status);
      return [];
    }

    const data = await response.json();
    return data.projects || [];
  } catch (error) {
    console.error("Error fetching projects:", error);
    return [];
  }
}

export default async function ProjectsPage() {
  const activeProjectId = await getServerProjectId();
  const authToken = await getServerAuthToken();

  // Build headers with auth token
  const headers: HeadersInit = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const projects = await fetchProjectsList(headers);

  return (
    <MsqdxGlassProjectAdminPanel
      initialProjects={projects}
      activeProjectId={activeProjectId}
    />
  );
}
