export const API_ROUTES = {
  /** POST: AI-assisted first project, target group, and persona (persona-api `/projects/bootstrap`). */
  projectsBootstrap: "/api/projects/bootstrap",
  personaAdminAvatar: (personaId: string) => `/api/persona-admin/${encodeURIComponent(personaId)}/avatar`,
} as const;

