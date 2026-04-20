export const API_ROUTES = {
  /** POST: AI-assisted first project, target group, and persona (persona-api `/projects/bootstrap`). */
  projectsBootstrap: "/api/projects/bootstrap",
  projectResearchStart: (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}/research/start`,
  projectResearchStatus: (projectId: string, runId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/research/status?run_id=${encodeURIComponent(runId)}`,
  projectResearchLatest: (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}/research/latest`,
  personaAdminAvatar: (personaId: string) => `/api/persona-admin/${encodeURIComponent(personaId)}/avatar`,
  /** POST: translate short persona field strings (en↔de); Next.js proxies to persona-api. */
  personaAdminTranslateFields: (personaId: string) =>
    `/api/persona-admin/${encodeURIComponent(personaId)}/translate-fields`,
} as const;

