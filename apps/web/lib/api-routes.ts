/** Prefix client-side API URLs when Next `basePath` is set (e.g. `/audion`). */
export function withNextBasePath(path: string): string {
  const base = (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BASE_PATH : "") || "";
  const trimmed = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return trimmed ? `${trimmed}${p}` : p;
}

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
  uxJourneyAgentRun: withNextBasePath("/api/ux-journey-agent/run"),
  uxJourneyAgentStatus: (jobId: string) => withNextBasePath(`/api/ux-journey-agent/run/${encodeURIComponent(jobId)}`),
  /** Latest single JPEG frame (works better through proxies than MJPEG in `<img>`). */
  uxJourneyAgentLiveFrame: (jobId: string) => withNextBasePath(`/api/ux-journey-agent/run/${encodeURIComponent(jobId)}/live`),
  uxJourneyAgentLiveStream: (jobId: string) =>
    withNextBasePath(`/api/ux-journey-agent/run/${encodeURIComponent(jobId)}/live/stream`),
  uxJourneyAgentVideo: (jobId: string) => withNextBasePath(`/api/ux-journey-agent/run/${encodeURIComponent(jobId)}/video`),
  /**
   * POST: optional ffmpeg polish before playback (proxied to agent). Can take minutes.
   * When ``force`` is true the upstream re-transcodes even if a polished MP4 already
   * exists — operator escape hatch for "I changed `UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR`
   * / `UX_JOURNEY_SLOWMO` and want the cached MP4 regenerated".
   */
  uxJourneyAgentVideoFinalize: (jobId: string, opts?: { force?: boolean }) =>
    withNextBasePath(
      `/api/ux-journey-agent/run/${encodeURIComponent(jobId)}/video/finalize${
        opts?.force ? "?force=1" : ""
      }`,
    ),
  /** GET: JPEG after each step (agent serves `/run/{jobId}/step/{n}/screenshot`; Next proxies here). */
  uxJourneyAgentStepScreenshot: (jobId: string, stepNo: number) =>
    withNextBasePath(`/api/ux-journey-agent/run/${encodeURIComponent(jobId)}/step/${stepNo}/screenshot`),
} as const;

