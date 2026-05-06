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

  targetGroups: "/admin/target-groups",
  targetGroupDetail: (targetGroupId: string) =>
    `/admin/target-groups/${encodeURIComponent(targetGroupId)}`,

  settingsApiDocs: "/admin/settings/api-docs",
} as const;

