import { ADMIN_ROUTES } from "./routes";

/** Persona detail link from target group v2 admin lists. */
export const targetGroupV2PersonaDetailHref = (personaId: string) =>
  ADMIN_ROUTES.personaV2Section(personaId, "basics");
