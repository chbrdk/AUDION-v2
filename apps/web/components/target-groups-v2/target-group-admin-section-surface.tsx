"use client";

import type { ComponentProps, ReactNode } from "react";
import { Box } from "@mui/material";
import { MsqdxDashboardCard } from "@msqdx/react";
import { THEME_ACCENT } from "../../lib/theme-accent";
import { PersonaV2SectionBlock } from "../personas-v2/persona-v2-section-block";

type MsqdxDashboardCardChildren = ComponentProps<typeof MsqdxDashboardCard>["children"];

export type TargetGroupAdminSectionSurfaceProps = {
  embedInSection?: boolean;
  cardId: string;
  title: string;
  icon: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  blockTitle?: string;
  hideBlockTitle?: boolean;
  children: ReactNode;
};

/** Legacy accordion (v1) or flat v2 block inside target group section stacks. */
export function TargetGroupAdminSectionSurface({
  embedInSection = false,
  cardId,
  title,
  icon,
  expanded,
  onToggle,
  blockTitle,
  hideBlockTitle = false,
  children,
}: TargetGroupAdminSectionSurfaceProps) {
  if (embedInSection) {
    const flatTitle = hideBlockTitle ? undefined : (blockTitle ?? title);
    return <PersonaV2SectionBlock title={flatTitle}>{children}</PersonaV2SectionBlock>;
  }

  return (
    <Box sx={{ gridColumn: "1 / -1" }}>
      <MsqdxDashboardCard
        id={cardId}
        title={title}
        icon={icon}
        iconColor={{ color: THEME_ACCENT.color }}
        expanded={expanded}
        onToggle={onToggle}
      >
        {children as MsqdxDashboardCardChildren}
      </MsqdxDashboardCard>
    </Box>
  );
}
