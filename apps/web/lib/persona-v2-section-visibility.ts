import type { PersonaV2SectionId } from "./persona-v2-sections";

export type PersonaAdminPresentation = "v1" | "v2-section";

/** Whether a v2 route section should render its editor blocks (v1 shows all). */
export function isPersonaV2SectionContentVisible(
  visibleSection: PersonaV2SectionId | undefined,
  presentation: PersonaAdminPresentation | undefined,
  blockSection: PersonaV2SectionId
): boolean {
  if (presentation !== "v2-section" || !visibleSection) {
    return true;
  }
  return visibleSection === blockSection;
}
