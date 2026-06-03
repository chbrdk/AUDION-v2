/** Target group v2 basics hero — icon column (mirrors persona hero sizing). */
export {
  PERSONA_BASICS_HERO_AVATAR_SIZE_PX as TARGET_GROUP_BASICS_HERO_ICON_SIZE_PX,
  PERSONA_BASICS_HERO_AVATAR_ICON_SIZE as TARGET_GROUP_BASICS_HERO_ICON_INNER_SIZE,
  PERSONA_BASICS_HERO_STACK_BREAKPOINT_PX as TARGET_GROUP_BASICS_HERO_STACK_BREAKPOINT_PX,
} from "./persona-basics-hero-layout";

import { ADMIN_ROUTES } from "./routes";

/** Default persona detail href for lists opened from target group v2 admin. */
export const targetGroupV2PersonaDetailHref = (personaId: string) =>
  ADMIN_ROUTES.personaV2Section(personaId, "basics");
