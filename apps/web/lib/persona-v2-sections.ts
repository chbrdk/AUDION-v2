import { ADMIN_ROUTES } from "./routes";

/** Persona detail sections for admin v2 (one route per section). */
export const PERSONA_V2_SECTION_IDS = [
  "basics",
  "personality",
  "communication",
  "pain-goals",
  "knowledge",
  "ux-history",
  "moodboard",
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
    id: "basics",
    icon: "person",
    labelKey: "personaV2.sections.basics.label",
    descriptionKey: "personaV2.sections.basics.description",
    v1AccordionId: "persona-basics",
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
] as const;

export const PERSONA_V2_DEFAULT_SECTION: PersonaV2SectionId = "basics";

/** Old routes merged into another section (e.g. `/bio` → basics, `/overview` → basics). */
export const PERSONA_V2_SECTION_LEGACY_ALIASES: Partial<Record<string, PersonaV2SectionId>> = {
  bio: "basics",
  overview: "basics",
  advanced: "basics",
};

export function isPersonaV2SectionId(value: string): value is PersonaV2SectionId {
  return (PERSONA_V2_SECTION_IDS as readonly string[]).includes(value);
}

export function resolvePersonaV2SectionId(value: string): PersonaV2SectionId | null {
  if (isPersonaV2SectionId(value)) {
    return value;
  }
  const mapped = PERSONA_V2_SECTION_LEGACY_ALIASES[value];
  return mapped ?? null;
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
