import { ADMIN_ROUTES } from "./routes";

/** Persona detail sections for admin v2 (one route per section). */
export const PERSONA_V2_SECTION_IDS = [
  "overview",
  "basics",
  "bio",
  "personality",
  "communication",
  "pain-goals",
  "knowledge",
  "ux-history",
  "moodboard",
  "advanced",
] as const;

export type PersonaV2SectionId = (typeof PERSONA_V2_SECTION_IDS)[number];

export type PersonaV2SectionDef = {
  id: PersonaV2SectionId;
  icon: string;
  labelKey: string;
  descriptionKey: string;
  /** v1 accordion id for migration mapping */
  v1AccordionId?: string;
};

export const PERSONA_V2_SECTIONS: readonly PersonaV2SectionDef[] = [
  {
    id: "overview",
    icon: "dashboard",
    labelKey: "personaV2.sections.overview.label",
    descriptionKey: "personaV2.sections.overview.description",
  },
  {
    id: "basics",
    icon: "person",
    labelKey: "personaV2.sections.basics.label",
    descriptionKey: "personaV2.sections.basics.description",
    v1AccordionId: "persona-basics",
  },
  {
    id: "bio",
    icon: "badge",
    labelKey: "personaV2.sections.bio.label",
    descriptionKey: "personaV2.sections.bio.description",
  },
  {
    id: "personality",
    icon: "psychology",
    labelKey: "personaV2.sections.personality.label",
    descriptionKey: "personaV2.sections.personality.description",
  },
  {
    id: "communication",
    icon: "forum",
    labelKey: "personaV2.sections.communication.label",
    descriptionKey: "personaV2.sections.communication.description",
  },
  {
    id: "pain-goals",
    icon: "track_changes",
    labelKey: "personaV2.sections.painGoals.label",
    descriptionKey: "personaV2.sections.painGoals.description",
  },
  {
    id: "knowledge",
    icon: "menu_book",
    labelKey: "personaV2.sections.knowledge.label",
    descriptionKey: "personaV2.sections.knowledge.description",
  },
  {
    id: "ux-history",
    icon: "route",
    labelKey: "personaV2.sections.uxHistory.label",
    descriptionKey: "personaV2.sections.uxHistory.description",
  },
  {
    id: "moodboard",
    icon: "grid_view",
    labelKey: "personaV2.sections.moodboard.label",
    descriptionKey: "personaV2.sections.moodboard.description",
  },
  {
    id: "advanced",
    icon: "tune",
    labelKey: "personaV2.sections.advanced.label",
    descriptionKey: "personaV2.sections.advanced.description",
  },
] as const;

export const PERSONA_V2_DEFAULT_SECTION: PersonaV2SectionId = "overview";

export function isPersonaV2SectionId(value: string): value is PersonaV2SectionId {
  return (PERSONA_V2_SECTION_IDS as readonly string[]).includes(value);
}

export function personaV2SectionHref(personaId: string, sectionId: PersonaV2SectionId): string {
  return ADMIN_ROUTES.personaV2Section(personaId, sectionId);
}

export function getPersonaV2SectionDef(sectionId: PersonaV2SectionId): PersonaV2SectionDef {
  const def = PERSONA_V2_SECTIONS.find((s) => s.id === sectionId);
  if (!def) {
    throw new Error(`Unknown persona v2 section: ${sectionId}`);
  }
  return def;
}
