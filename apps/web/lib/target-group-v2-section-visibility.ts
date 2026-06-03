import type { TargetGroupV2SectionId } from "./target-group-v2-sections";

export type TargetGroupAdminPresentation = "v1" | "v2-section";

/** Whether a v2 route section should render its editor blocks (v1 shows all). */
export function isTargetGroupV2SectionContentVisible(
  visibleSection: TargetGroupV2SectionId | undefined,
  presentation: TargetGroupAdminPresentation | undefined,
  blockSection: TargetGroupV2SectionId
): boolean {
  if (presentation !== "v2-section" || !visibleSection) {
    return true;
  }
  return visibleSection === blockSection;
}
