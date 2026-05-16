export const ADMIN_ROUTES = {
  dashboard: "/admin",
  setup: "/admin/setup",

  projects: "/admin/projects",
  projectDetail: (projectId: string) => `/admin/projects/${encodeURIComponent(projectId)}`,

  journeys: "/admin/journeys",
  journeyNew: "/admin/journeys/new",
  journeyDetail: (journeyId: string) => `/admin/journeys/${encodeURIComponent(journeyId)}`,

  uxJourneyAgent: "/admin/ux-journey-agent",

  personas: "/admin/personas",
  personaDetail: (personaId: string) => `/admin/personas/${encodeURIComponent(personaId)}`,

  /** Experimental layout: section sub-nav + one section per route. */
  personasV2: "/admin/personas-v2",
  personaV2Detail: (personaId: string) =>
    `/admin/personas-v2/${encodeURIComponent(personaId)}`,
  personaV2Section: (personaId: string, sectionId: string) =>
    `/admin/personas-v2/${encodeURIComponent(personaId)}/${encodeURIComponent(sectionId)}`,

  targetGroups: "/admin/target-groups",
  targetGroupDetail: (targetGroupId: string) =>
    `/admin/target-groups/${encodeURIComponent(targetGroupId)}`,

  settingsApiDocs: "/admin/settings/api-docs",
} as const;

