export const API_ROUTES = {
  /** POST: AI-assisted first project, target group, and persona (persona-api `/projects/bootstrap`). */
  projectsBootstrap: "/api/projects/bootstrap",
  personaAdminAvatar: (personaId: string) => `/api/persona-admin/${encodeURIComponent(personaId)}/avatar`,
  /** POST: translate short persona field strings (en↔de); Next.js proxies to persona-api. */
  personaAdminTranslateFields: (personaId: string) =>
    `/api/persona-admin/${encodeURIComponent(personaId)}/translate-fields`,
} as const;

