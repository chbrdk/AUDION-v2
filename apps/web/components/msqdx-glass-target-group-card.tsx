"use client";

import type { TargetGroupListItem } from "@msqdx-glass/types";
import { MsqdxTargetGroupCard } from "@msqdx/react";

export type MsqdxGlassTargetGroupCardProps = {
  targetGroup: TargetGroupListItem;
  selected?: boolean;
  onSelect?: (targetGroupId: string) => void;
};

export const MsqdxGlassTargetGroupCard = ({
  targetGroup,
  selected,
  onSelect,
}: MsqdxGlassTargetGroupCardProps) => (
  <MsqdxTargetGroupCard
    targetGroup={{
      id: targetGroup.id,
      name: targetGroup.name,
      segment: targetGroup.segment,
      description: targetGroup.description ?? undefined,
      personaCount: targetGroup.personaCount,
      knowledgeEntryCount: targetGroup.knowledgeEntryCount,
    }}
    selected={selected}
    onSelect={onSelect}
  />
);
