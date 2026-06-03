"use client";

import { MsqdxGlassTargetGroupAdminPanel } from "../msqdx-glass-target-group-admin-panel";
import type { TargetGroupV2SectionId } from "../../lib/target-group-v2-sections";

export type MsqdxGlassTargetGroupAdminSectionViewProps = {
  targetGroupId: string;
  sectionId: TargetGroupV2SectionId;
  docsUrl: string;
};

export function MsqdxGlassTargetGroupAdminSectionView({
  targetGroupId,
  sectionId,
  docsUrl,
}: MsqdxGlassTargetGroupAdminSectionViewProps) {
  return (
    <MsqdxGlassTargetGroupAdminPanel
      initialList={{ items: [], total: 0, page: 1, page_size: 50 }}
      docsUrl={docsUrl}
      mode="detail"
      activeTargetGroupId={targetGroupId}
      presentation="v2-section"
      visibleSection={sectionId}
    />
  );
}
