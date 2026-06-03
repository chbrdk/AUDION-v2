import { ADMIN_ROUTES } from "./routes";

/** Target group detail sections for admin v2 (one route per section). */
export const TARGET_GROUP_V2_SECTION_IDS = [
  "basics",
  "personas",
  "knowledge",
  "documents",
  "explorer",
] as const;

export type TargetGroupV2SectionId = (typeof TARGET_GROUP_V2_SECTION_IDS)[number];

export type TargetGroupV2SectionDef = {
  id: TargetGroupV2SectionId;
  icon: string;
  labelKey: string;
  descriptionKey: string;
  /** v1 accordion id for migration mapping */
  v1AccordionId?: string;
};

export const TARGET_GROUP_V2_SECTIONS: readonly TargetGroupV2SectionDef[] = [
  {
    id: "basics",
    icon: "groups",
    labelKey: "targetGroupV2.sections.basics.label",
    descriptionKey: "targetGroupV2.sections.basics.description",
    v1AccordionId: "basic",
  },
  {
    id: "personas",
    icon: "person",
    labelKey: "targetGroupV2.sections.personas.label",
    descriptionKey: "targetGroupV2.sections.personas.description",
    v1AccordionId: "personas",
  },
  {
    id: "knowledge",
    icon: "menu_book",
    labelKey: "targetGroupV2.sections.knowledge.label",
    descriptionKey: "targetGroupV2.sections.knowledge.description",
    v1AccordionId: "knowledge",
  },
  {
    id: "documents",
    icon: "description",
    labelKey: "targetGroupV2.sections.documents.label",
    descriptionKey: "targetGroupV2.sections.documents.description",
    v1AccordionId: "documents",
  },
  {
    id: "explorer",
    icon: "search",
    labelKey: "targetGroupV2.sections.explorer.label",
    descriptionKey: "targetGroupV2.sections.explorer.description",
    v1AccordionId: "knowledge-explorer",
  },
] as const;

export const TARGET_GROUP_V2_DEFAULT_SECTION: TargetGroupV2SectionId = "basics";

export function isTargetGroupV2SectionId(value: string): value is TargetGroupV2SectionId {
  return (TARGET_GROUP_V2_SECTION_IDS as readonly string[]).includes(value);
}

export function resolveTargetGroupV2SectionId(value: string): TargetGroupV2SectionId | null {
  return isTargetGroupV2SectionId(value) ? value : null;
}

export function targetGroupV2SectionHref(
  targetGroupId: string,
  sectionId: TargetGroupV2SectionId
): string {
  return ADMIN_ROUTES.targetGroupV2Section(targetGroupId, sectionId);
}

export function getTargetGroupV2SectionDef(sectionId: TargetGroupV2SectionId): TargetGroupV2SectionDef {
  const def = TARGET_GROUP_V2_SECTIONS.find((s) => s.id === sectionId);
  if (!def) {
    throw new Error(`Unknown target group v2 section: ${sectionId}`);
  }
  return def;
}
