"use client";

import { MsqdxGlassTargetGroupAdminSectionView } from "./msqdx-glass-target-group-admin-section-view";
import type { TargetGroupV2SectionId } from "../../lib/target-group-v2-sections";

export type MsqdxGlassTargetGroupV2SectionContentProps = {
  targetGroupId: string;
  sectionId: TargetGroupV2SectionId;
  docsUrl: string;
};

export function MsqdxGlassTargetGroupV2SectionContent({
  targetGroupId,
  sectionId,
  docsUrl,
}: MsqdxGlassTargetGroupV2SectionContentProps) {
  return (
    <MsqdxGlassTargetGroupAdminSectionView
      targetGroupId={targetGroupId}
      sectionId={sectionId}
      docsUrl={docsUrl}
    />
  );
}
