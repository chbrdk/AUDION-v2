export const API_ROUTES = {
  /** GET: CHECKION projects for the integration token (persona-api `/integrations/checkion/projects`). */
  checkionProjects: "/api/integrations/checkion/projects",
  /** POST: AI-assisted first project, target group, and persona (persona-api `/projects/bootstrap`). */
  projectsBootstrap: "/api/projects/bootstrap",
  projectResearchStart: (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}/research/start`,
  projectResearchStatus: (projectId: string, runId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/research/status?run_id=${encodeURIComponent(runId)}`,
  projectResearchLatest: (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}/research/latest`,
  /** GET: aggregated CHECKION Deep Scan page topics (persona-api proxy). */
  projectCheckionSiteTopics: (projectId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/integrations/checkion/site-topics`,
  projectResearchStream: (projectId: string, runId: string, after?: string | null) => {
    const qs = new URLSearchParams({ run_id: runId });
    if (after) qs.set("after", after);
    return `/api/projects/${encodeURIComponent(projectId)}/research/stream?${qs.toString()}`;
  },
  personaAdminAvatar: (personaId: string) => `/api/persona-admin/${encodeURIComponent(personaId)}/avatar`,
  /** POST: translate short persona field strings (en↔de); Next.js proxies to persona-api. */
  personaAdminTranslateFields: (personaId: string) =>
    `/api/persona-admin/${encodeURIComponent(personaId)}/translate-fields`,

  /** UX Journey Agent (persona-api proxy): start + status + live/video passthrough. */
  uxJourneyAgentRun: "/api/ux-journey-agent/run",
  uxJourneyAgentStatus: (jobId: string) => `/api/ux-journey-agent/run/${encodeURIComponent(jobId)}`,
  uxJourneyAgentLiveStream: (jobId: string) => `/api/ux-journey-agent/run/${encodeURIComponent(jobId)}/live/stream`,
  uxJourneyAgentVideo: (jobId: string) => `/api/ux-journey-agent/run/${encodeURIComponent(jobId)}/video`,
  /** GET: JPEG after each step (agent serves `/run/{jobId}/step/{n}/screenshot`; Next proxies here). */
  uxJourneyAgentStepScreenshot: (jobId: string, stepNo: number) =>
    `/api/ux-journey-agent/run/${encodeURIComponent(jobId)}/step/${stepNo}/screenshot`,
} as const;

